interface OutputChecker {
    (output: string): boolean;
}

interface RunCodeResponse {
    output: string;
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
            const response = await fetch("http://3.128.118.239/run-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code })
            });
            const result: RunCodeResponse = await response.json();

            if (this.outputChecker && this.resultElement) {
                const isCorrect = this.outputChecker(result.output);
                this.resultElement.innerHTML = isCorrect
                    ? `<span style="color: green;">Correct: ${result.output}</span>`
                    : `<span style="color: red;">Incorrect: ${result.output}</span>`;
            } else if (this.resultElement) {
                this.resultElement.innerHTML = `<pre>${result.output}</pre>`;
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
    const sections = document.querySelectorAll<HTMLElement>("section.level2#variables");

    sections.forEach((section, index) => {
        // Create editor container
        const containerId = `editor-container-${index}`;
        section.id = containerId;

        // Initialize EditorContainer with optional initial value
        new EditorContainer(containerId, "(** Type your OCaml code here *)\nlet x = 42;;", monaco);
        // const editorContainer = document.createElement("div");
        // editorContainer.style.width = "100%";
        // editorContainer.style.height = "200px";
        // editorContainer.id = `ocaml-editor-${index}`;
        // section.appendChild(editorContainer);

        // // Initialize the Monaco editor in the container
        // monaco.editor.create(editorContainer, {
        //     value: "// Type your OCaml code here\nlet x = 42;",
        //     language: "ocaml",
        //     theme: "vs-light",
        //     automaticLayout: true,
        //     minimap: { enabled: false }
        // });
    });
}

// Load and initialize Monaco Editor when DOM is ready
document.addEventListener("DOMContentLoaded", loadMonacoEditor);
