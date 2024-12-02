class SearchBar {
    private ws: WebSocket | null = null;
    private searchBar: HTMLDivElement | null = null;
    private searchInput: HTMLInputElement | null = null;
    private resultsContainer: HTMLDivElement | null = null;

    constructor() {
        this.setupHotkey();
    }

    private setupHotkey(): void {
        document.addEventListener("keydown", (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "k") {
                event.preventDefault();
                if (this.searchBar) {
                    this.closeSearchBar();
                } else {
                    this.openSearchBar();
                }
            } else if (event.key === "Escape" && this.searchBar) {
                this.closeSearchBar();
            }
        });
    }

    private openSearchBar(): void {
        // Create the search bar
        this.searchBar = document.createElement("div");
        this.searchBar.id = "search-bar";

        // Create the input box
        this.searchInput = document.createElement("input");
        this.searchInput.id = "search-input";
        this.searchInput.type = "text";
        this.searchInput.placeholder = "Type to search...";
        this.searchInput.autocomplete = "off";
        this.searchInput.addEventListener("input", () => this.handleInputChange());
        this.searchBar.appendChild(this.searchInput);

        // Create the results container
        this.resultsContainer = document.createElement("div");
        this.resultsContainer.id = "search-results";
        this.searchBar.appendChild(this.resultsContainer);

        // Append the search bar to the body
        document.body.appendChild(this.searchBar);

        // Establish WebSocket connection
        this.ws = new WebSocket("wss://camel.elliotliu.com/search/ws");
        this.ws.onmessage = (event) => this.updateResults(JSON.parse(event.data), this.searchInput?.value || "");

        // Focus the input field
        this.searchInput.focus();
    }

    private closeSearchBar(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.searchBar) {
            this.searchBar.remove();
            this.searchBar = null;
            this.searchInput = null;
            this.resultsContainer = null;
        }
    }

    private handleInputChange(): void {
        if (this.ws && this.searchInput) {
            const query = this.searchInput.value.trim();
            if (query) {
                this.ws.send(query);
            } else {
                this.clearResults();
            }
        }
    }

    private updateResults(results: Array<any>, query: string): void {
        if (!this.resultsContainer) return;
    
        this.resultsContainer.innerHTML = "";
    
        const highlightQuery = (text: string, query: string): string => {
            // Escape regex special characters in the query
            const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(`(${safeQuery})`, "gi"); // Case-insensitive match
            return text.replace(regex, "<strong>$1</strong>");
        };
    
        results.forEach((result) => {
            const resultDiv = document.createElement("div");
            resultDiv.className = "search-result";
    
            const highlightedSnippet = highlightQuery(result.snippet, query);
    
            resultDiv.innerHTML = `
                <a href="${result.url}" target="_blank" class="result-link">
                    <strong>${result.title}</strong>
                    <p>${highlightedSnippet}</p>
                </a>
            `;
    
            this.resultsContainer?.appendChild(resultDiv);
        });
    }

    private clearResults(): void {
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = "";
        }
    }
}

new SearchBar();