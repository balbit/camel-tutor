import { register } from "module";
import { extractRunnableCode } from "./extract-ocaml.js";
import { submitCode } from "./api.js";
import { initializeQuizzes } from "./init-questions.js";
import { escape } from "querystring";
import { scrollToHash } from "./scroll-helper.js";

interface OutputChecker {
    checkOutput: (output: string) => Promise<[boolean, string]>;
    seeTests: () => string;
}

interface RunCodeResponse {
    output: string;
}

function isMobileScreen(): boolean {
    return window.matchMedia("(max-width: 768px)").matches;
}

const MIN_HEIGHT = 130; // in pixels
const INITIAL_MAX_HEIGHT = 200; // in pixels
const FOCUSED_MAX_HEIGHT = 700; // in pixels
const LINE_HEIGHT = 20; // Approximate height per line in pixels

export class EditorContainer {
    private containerId: string;
    private outputChecker: OutputChecker | null;
    private resultElement: HTMLElement | null;
    private editor: any | null;
    private editorDiv: any | null;
    private submitButton: HTMLButtonElement | null;
    private editorFocused: boolean;
    private inspectingTests: boolean;

    constructor(containerId: string, initialValue: string, monaco: any, outputChecker: OutputChecker | null = null) {
        this.containerId = containerId;
        this.outputChecker = outputChecker;
        this.resultElement = null;
        this.editor = null;
        this.editorDiv = null;
        this.submitButton = null;
        this.editorFocused = false;
        this.inspectingTests = false;
        this.createEditor(initialValue, monaco);
        this.setupResponsiveBehavior(monaco);
    }

    private setupResponsiveBehavior(monaco: any): void {
        // Listen for window resize events
        window.addEventListener("resize", () => {
            const showLineNumbers = !isMobileScreen();
            if (this.editor) {
                this.editor.updateOptions({ lineNumbers: showLineNumbers ? "on" : "off" });
            }
        });
    }

    private calculateHeight(lineCount: number, maxHeight: number): number {
        const calculatedHeight = lineCount * LINE_HEIGHT + 20; // Adding padding
        return Math.min(Math.max(calculatedHeight, MIN_HEIGHT), maxHeight);
    }

    private adjustHeight(): void {
        if (!this.editorDiv || !this.editor) return;

        const maxHeight = this.editorFocused ? FOCUSED_MAX_HEIGHT : INITIAL_MAX_HEIGHT;

        // Get the number of lines in the editor
        const lineCount = this.editor.getModel()?.getLineCount() || 1;
        const newHeight = this.calculateHeight(lineCount, maxHeight);

        // Update the editor div's height
        this.editorDiv.style.height = `${newHeight}px`;

        // Notify Monaco to layout the editor correctly
        this.editor.layout();
    }

    private createEditor(initialValue: string, monaco: any): void {
        const container = document.getElementById(this.containerId);
        if (!container) throw new Error(`Container with ID ${this.containerId} not found`);

        const editorDiv = document.createElement("div");
        editorDiv.style.width = "100%";
        editorDiv.style.height = "100px";
        editorDiv.classList.add("monaco-editor-inactive");
        container.appendChild(editorDiv);
        this.editorDiv = editorDiv;

        this.editor = monaco.editor.create(editorDiv, {
            value: initialValue,
            language: "ocaml",
            theme: "custom-light-theme",
            automaticLayout: true,
            minimap: { enabled: false },
            lineNumbers: isMobileScreen() ? "off" : "on",
            fontFamily: "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace"
        });

        this.editor.onDidChangeModelContent(() => {
            this.adjustHeight();
        });

        // Listen to focus and blur events
        this.editor.onDidFocusEditorWidget(() => {
            this.adjustHeight();
        });

        this.editor.onDidBlurEditorWidget(() => {
            this.adjustHeight();
        });

        container.addEventListener("click", (event) => {
            editorDiv.classList.remove("monaco-editor-inactive");
            if (!this.editorFocused) {
                this.editorFocused = true;
                editorDiv.classList.add("monaco-editor-bloom");
        
                setTimeout(() => {
                    editorDiv.classList.remove("monaco-editor-bloom");
                }, 600);

                if (!isMobileScreen()) { // Don't auto-focus on mobile
                    this.editor.focus();

                    const editorMousePos = this.editor.getPositionAt(event.clientX, event.clientY);
                    // TODO: Set cursor position based on mouse click
                    // Currently this properly focuses the editor but sets the position to the front
                    if (editorMousePos) {
                        this.editor.setPosition(editorMousePos);
                    }
                }

            }
        });

        document.addEventListener("click", (event) => {
            if (this.editorFocused && !container.contains(event.target as Node)) {
                this.editorFocused = false;
                editorDiv.classList.add("monaco-editor-inactive");
            }
        });

        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => this.submitCode());

        const submitButton = document.createElement("button");
        submitButton.className = "run-code-button";
        submitButton.innerText = "Run Code";
        submitButton.onclick = () => this.submitCode();
        this.submitButton = submitButton;

        const buttonContainer = document.createElement("div");
        buttonContainer.style.display = "flex";
        buttonContainer.style.gap = "10px"; // Add some space between buttons

        buttonContainer.appendChild(submitButton);
        if (this.outputChecker) {
            const seeTestsButton = document.createElement("button");
            seeTestsButton.className = "see-tests-button";
            seeTestsButton.innerText = "See Tests";
            seeTestsButton.onclick = () => {
                this.inspectingTests = !this.inspectingTests;
                if (this.inspectingTests) {
                    const testCode = this.outputChecker?.seeTests();
                    const currentValue = this.editor?.getValue() || "";
                    this.editor?.setValue(currentValue + "\n(* Test cases below: *)\n" + testCode);

                    seeTestsButton.innerText = "Hide Tests";
                    this.resultElement!.style.display = "block";
                } else {
                    // Find the line with "Test cases below" and remove it plus the following lines
                    const currentValue = this.editor?.getValue() || "";
                    const lines = currentValue.split("\n");
                    const testLineIndex: number = lines.findIndex((line: string) => line.includes("Test cases below"));
                    if (testLineIndex !== -1) {
                        lines.splice(testLineIndex, lines.length - testLineIndex);
                        this.editor?.setValue(lines.join("\n"));
                    }
                    seeTestsButton.innerText = "See Tests";
                    this.resultElement!.style.display = "none";
                }
            };
            buttonContainer.appendChild(seeTestsButton);
        }

        container.appendChild(buttonContainer);

        this.resultElement = document.createElement("div");
        this.resultElement.style.display = "none"; // Hide initially
        container.appendChild(this.resultElement);
    }

    private async submitCode(): Promise<void> {
        const code = this.editor?.getValue() || "";
        const submitButton = this.submitButton;
        if (submitButton) {
            submitButton.innerHTML = 'Running... <span class="spinner"></span>';
            submitButton.classList.add('submitting');
        }
        const escapeHtml = (str: string) => 
            str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        try {
            if (this.outputChecker && this.resultElement && !this.inspectingTests) {
                const [isCorrect, message] = await this.outputChecker.checkOutput(code);
                const escapedOutput = escapeHtml(message);
                this.resultElement.innerHTML = isCorrect
                    ? `<span style="color: green;">Correct:</span><pre style="color: green;">${escapedOutput}</pre>`
                    : `<span style="color: red;">Incorrect:</span><pre style="color: red;">${escapedOutput}</pre>`;
                
                this.resultElement.style.display = "block";
                this.resultElement.innerHTML = `<pre class="result-output">${escapedOutput}</pre>`;
            } else if (this.resultElement) {
                const result: RunCodeResponse = await submitCode(code);
        
                const escapedOutput = escapeHtml(result.output);

                if (escapedOutput.trim()) { // Only show if there is content
                    this.resultElement.style.display = "block";
                    this.resultElement.innerHTML = `<pre class="result-output">${escapedOutput}</pre>`;
                } else {
                    this.resultElement.style.display = "none"; // Hide if no content
                }
            }

            if (submitButton) {
                submitButton.classList.add('success');
                setTimeout(() => {
                    submitButton.classList.remove('success');
                }, 1000);
            }
        } catch (error) {
            if (this.resultElement) {
                this.resultElement.innerHTML = `<span style="color: red;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</span>`;
            }
        } finally {
            if (submitButton) {
                submitButton.innerHTML = 'Run Code';
                submitButton.classList.remove('submitting');
            }
        }
    }
}

function registerMonacoOcaml(monaco: any) {
    // Register OCaml language definition
    monaco.languages.register({ id: 'ocaml' });

    monaco.languages.setMonarchTokensProvider('ocaml', {
        keywords: [
            'and', 'as', 'assert', 'begin', 'class', 'constraint', 'do', 'done', 'downto', 'else',
            'end', 'exception', 'external', 'for', 'fun', 'function', 'functor', 'if', 'in', 'include',
            'inherit', 'initializer', 'lazy', 'let', 'match', 'method', 'module', 'mutable', 'new',
            'object', 'of', 'open', 'or', 'private', 'rec', 'sig', 'struct', 'then', 'to', 'try', 'type',
            'val', 'virtual', 'when', 'while', 'with'
        ],
        typeKeywords: ['int', 'float', 'string', 'bool', 'unit', 'list', 'array', 'option'],
        
        // Define the default tokenizer
        tokenizer: {
            root: [
            // Identifiers and keywords
            [/[a-zA-Z_]\w*/, {
                cases: {
                '@keywords': 'keyword',
                '@default': 'identifier'
                }
            }],
        
            // Types
            [/[A-Z][\w]*/, 'type.identifier'],
        
            // Whitespace
            { include: '@whitespace' },
        
            // Delimiters and operators (replacing @operators with regex directly)
            [/[{}()\[\]]/, '@brackets'],
            [/[-=><!~?:&|+\*\/\^%@]+/, 'operator'], // Pattern matching operators
        
            // Numbers
            [/\b(true|false)\b/, 'number'],
            [/\d+/, 'number'],

            // Punctuation
            [/[,;:._]/, 'punctuation'], // Matches , ; : .
        
            // Strings
            [/"([^"\\]|\\.)*$/, 'string.invalid'],  // non-terminated string
            [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
            ],
        
            string: [
            [/[^\\"]+/, 'string'],
            [/\\./, 'string.escape.invalid'],
            [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
            ],
        
            whitespace: [
            [/[ \t\r\n]+/, 'white'],
            [/\(\*/, 'comment', '@comment']
            ],
        
            comment: [
            [/[^\*]+/, 'comment'],
            [/\*\)/, 'comment', '@pop'],
            [/[\*]/, 'comment']
            ],
        }
        });

        monaco.languages.setLanguageConfiguration('ocaml', {
        comments: {
            lineComment: '//',
            blockComment: ['(*', '*)']
        },
        brackets: [
            ['{', '}'],
            ['[', ']'],
            ['(', ')']
        ]
    });

    monaco.languages.setLanguageConfiguration('ocaml', {
        comments: {
          lineComment: '//',
          blockComment: ['(*', '*)']
        },
        brackets: [
          ['{', '}'],
          ['[', ']'],
          ['(', ')']
        ],
        autoClosingPairs: [
          { open: '(', close: ')' },
          { open: '[', close: ']' },
          { open: '{', close: '}' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ]
      });
    
    monaco.editor.defineTheme('custom-light-theme', {
    base: 'vs', // Starts with the light base theme
    inherit: true, // Inherit Monaco's default settings
    rules: [
        { token: 'keyword', foreground: '0077AA' }, // copied
        { token: 'type.identifier', foreground: '1C7E71' },
        { token: 'operator', foreground: '9A6E3A' },
        { token: 'string', foreground: '669900' },
        { token: 'number', foreground: '990055' },
        { token: 'comment', foreground: '708090' },
        { token: 'identifier', foreground: '000000' },
    ],
    colors: {
        'editor.background': '#FAFAFA', // Light gray background
        'editor.lineHighlightBackground': '#F3F4F4', // Highlight line background
        'editorLineNumber.foreground': '#B0B0B0', // Line numbers in gray
        'editorCursor.foreground': '#333333', // Cursor in dark gray
    }
    });
}

// Function to load the Monaco editor scripts and initialize editors
async function loadMonacoEditor(): Promise<void> {
    // Initialize the backend server by empty submission
    submitCode(`let camel_tutor = "Welcome to CamelTutor! :)";;\nopen Base;;\nopen Core;;\n`).catch(console.error);

    return new Promise((resolve, reject) => {

        // Dynamically load Monaco's AMD loader from CDN
        const monacoLoader = document.createElement("script");
        monacoLoader.src = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.31.1/min/vs/loader.min.js";
        monacoLoader.onload = () => {
            // Configure Monaco's path for loading additional modules
            (window as any).require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.31.1/min/vs" }});
            (window as any).require(["vs/editor/editor.main"], (monaco: any) => {
                (window as any).monaco = monaco;
                registerMonacoOcaml(monaco);
                initializeEditors(monaco, resolve);
            });
        };
        document.body.appendChild(monacoLoader);
    });
}

// Function to initialize editors in each specified section
function initializeEditors(monaco: any, resolve: any) {
    const sections = document.querySelectorAll<HTMLElement>("div.highlight");

    sections.forEach((section, index) => {
        const containerId = `editor-container-${index}`;
        section.id = containerId;

        // Find the code block within the div.highlight
        const codeBlock = section.querySelector("code.language-ocaml");
        if (!codeBlock) {
            return;
        }

        // Get the code text content, or use a default if not found
        const initialCode = codeBlock ? extractRunnableCode(codeBlock.textContent ?? "(** No code found **)" ) : "(** No code found **)";

        // Initialize EditorContainer with the extracted code
        new EditorContainer(containerId, initialCode, monaco);
    });

    resolve();
}

function loadScript(src: string) {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.defer = true;
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

// Load and initialize Monaco Editor when DOM is ready
document.addEventListener("DOMContentLoaded", async() => {
    await loadMonacoEditor();

    initializeQuizzes();
    // Load back the Prism.js and Modernizr scripts we disabled
    await loadScript('js/prism.js');
    await loadScript('js/min/modernizr-min.js');

    scrollToHash();
});
