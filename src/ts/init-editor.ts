import { register } from "module";
import { extractRunnableCode } from "./extract-ocaml.js";

interface OutputChecker {
    (output: string): boolean;
}

interface RunCodeResponse {
    output: string;
}

function submitCode(code: string): Promise<RunCodeResponse> {
    const sessionId = localStorage.getItem("sessionId") || crypto.randomUUID();
    localStorage.setItem("sessionId", sessionId);

    const response = fetch("https://camel.elliotliu.com/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, sessionId })
    });

    return response.then(res => res.json());
}

class EditorContainer {
    private containerId: string;
    private outputChecker: OutputChecker | null;
    private resultElement: HTMLElement | null;
    private editor: any | null;
    private submitButton: HTMLButtonElement | null;
    private editorFocused: boolean;

    constructor(containerId: string, initialValue: string, monaco: any, outputChecker: OutputChecker | null = null) {
        this.containerId = containerId;
        this.outputChecker = outputChecker;
        this.resultElement = null;
        this.editor = null;
        this.submitButton = null;
        this.editorFocused = false;
        this.createEditor(initialValue, monaco);
    }

    private createEditor(initialValue: string, monaco: any): void {
        const container = document.getElementById(this.containerId);
        if (!container) throw new Error(`Container with ID ${this.containerId} not found`);

        const editorDiv = document.createElement("div");
        editorDiv.style.width = "100%";
        editorDiv.style.height = "200px";
        editorDiv.classList.add("monaco-editor-inactive");
        container.appendChild(editorDiv);

        this.editor = monaco.editor.create(editorDiv, {
            value: initialValue,
            language: "ocaml",
            theme: "custom-light-theme",
            automaticLayout: true,
            minimap: { enabled: false },
            fontFamily: "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace"
        });

        container.addEventListener("click", () => {
            editorDiv.classList.remove("monaco-editor-inactive");
            if (!this.editorFocused) {
                this.editorFocused = true;
                editorDiv.classList.add("monaco-editor-bloom");
        
                setTimeout(() => {
                    editorDiv.classList.remove("monaco-editor-bloom");
                }, 600);
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
        container.appendChild(submitButton);

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

        try {
            const result: RunCodeResponse = await submitCode(code);

            const escapeHtml = (str: string) => 
                str.replace(/&/g, "&amp;")
                   .replace(/</g, "&lt;")
                   .replace(/>/g, "&gt;");
    
            const escapedOutput = escapeHtml(result.output);
    
            if (this.outputChecker && this.resultElement) {
                const isCorrect = this.outputChecker(result.output);
                this.resultElement.innerHTML = isCorrect
                    ? `<span style="color: green;">Correct:</span><pre style="color: green;">${escapedOutput}</pre>`
                    : `<span style="color: red;">Incorrect:</span><pre style="color: red;">${escapedOutput}</pre>`;
            } else if (this.resultElement) {
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
function loadMonacoEditor() {
    // Initialize the backend server by empty submission
    submitCode(`let camel_tutor = "Welcome to CamelTutor! :)";;\n`).catch(console.error);

    // Dynamically load Monaco's AMD loader from CDN
    const monacoLoader = document.createElement("script");
    monacoLoader.src = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.31.1/min/vs/loader.min.js";
    monacoLoader.onload = () => {
        // Configure Monaco's path for loading additional modules
        (window as any).require.config({ paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.31.1/min/vs" }});
        (window as any).require(["vs/editor/editor.main"], (monaco: any) => {
            registerMonacoOcaml(monaco);
            initializeEditors(monaco);
        });
    };
    document.body.appendChild(monacoLoader);
}

// Function to initialize editors in each specified section
function initializeEditors(monaco: any) {
    const sections = document.querySelectorAll<HTMLElement>("div.highlight");

    sections.forEach((section, index) => {
        const containerId = `editor-container-${index}`;
        section.id = containerId;

        // Find the code block within the div.highlight
        const codeBlock = section.querySelector("code.language-ocaml");

        // Get the code text content, or use a default if not found
        const initialCode = codeBlock ? extractRunnableCode(codeBlock.textContent ?? "(** No code found **)" ) : "(** No code found **)";

        // Initialize EditorContainer with the extracted code
        new EditorContainer(containerId, initialCode, monaco);
    });
}

// Load and initialize Monaco Editor when DOM is ready
document.addEventListener("DOMContentLoaded", loadMonacoEditor);
