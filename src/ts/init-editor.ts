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

    constructor(containerId: string, initialValue: string, monaco: any, outputChecker: OutputChecker | null = null) {
        this.containerId = containerId;
        this.outputChecker = outputChecker;
        this.resultElement = null;
        this.editor = null;
        this.createEditor(initialValue, monaco);
    }

    private createEditor(initialValue: string, monaco: any): void {
        const container = document.getElementById(this.containerId);
        if (!container) throw new Error(`Container with ID ${this.containerId} not found`);

        const editorDiv = document.createElement("div");
        editorDiv.style.width = "100%";
        editorDiv.style.height = "200px";
        container.appendChild(editorDiv);

        this.editor = monaco.editor.create(editorDiv, {
            value: initialValue,
            language: "ocaml",
            theme: "vs-light",
            automaticLayout: true,
            minimap: { enabled: false }
        });

        const submitButton = document.createElement("button");
        submitButton.innerText = "Run Code";
        submitButton.onclick = () => this.submitCode();
        container.appendChild(submitButton);

        this.resultElement = document.createElement("div");
        this.resultElement.style.marginTop = "10px";
        this.resultElement.style.padding = "10px";
        this.resultElement.style.border = "1px solid #ddd";
        container.appendChild(this.resultElement);
    }

    private async submitCode(): Promise<void> {
        const code = this.editor?.getValue() || "";
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
                // Set the escaped output to avoid HTML interpretation
                this.resultElement.innerHTML = `<pre>${escapedOutput}</pre>`;
            }
        } catch (error) {
            if (this.resultElement) {
                this.resultElement.innerHTML = `<span style="color: red;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</span>`;
            }
        }
    }
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
