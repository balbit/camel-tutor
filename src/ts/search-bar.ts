class SearchBar {
    private ws: WebSocket | null = null;
    private searchBar: HTMLDivElement | null = null;
    private searchInput: HTMLInputElement | null = null;
    private resultsContainer: HTMLDivElement | null = null;
    private currentQuery: string = ""; // Store the current query
    private currentOffset: number = 0; // Track the offset for pagination
    private loading: boolean = false; // Prevent multiple simultaneous loads

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
        this.resultsContainer.addEventListener("scroll", () => this.handleScroll());
        this.searchBar.appendChild(this.resultsContainer);

        // Append the search bar to the body
        document.body.appendChild(this.searchBar);

        // Establish WebSocket connection
        this.ws = new WebSocket("wss://camel.elliotliu.com/search/ws");
        this.ws.onmessage = (event) => this.updateResults(JSON.parse(event.data));

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
        this.currentQuery = "";
        this.currentOffset = 0;
        this.loading = false;
    }

    private handleInputChange(): void {
        if (this.ws && this.searchInput) {
            const query = this.searchInput.value.trim();
            if (query && query !== this.currentQuery) {
                this.currentQuery = query;
                this.currentOffset = 0; // Reset the offset for a new query
                this.loading = false;
                this.clearResults();
                this.ws.send(JSON.stringify({ query, offset: this.currentOffset }));
            } else if (!query) {
                this.clearResults();
            }
        }
    }

    private handleScroll(): void {
        if (this.resultsContainer && !this.loading) {
            const { scrollTop, scrollHeight, clientHeight } = this.resultsContainer;
            if (scrollTop + clientHeight >= scrollHeight - 50) {
                // User is near the bottom, load more results
                this.loadMoreResults();
            }
        }
    }

    private loadMoreResults(): void {
        if (this.ws && this.currentQuery) {
            this.loading = true; // Prevent multiple requests
            this.currentOffset += 10; // Increment the offset by page size
            this.ws.send(JSON.stringify({ query: this.currentQuery, offset: this.currentOffset }));
        }
    }

    private updateResults(results: Array<any>): void {
        if (!this.resultsContainer) return;

        results.forEach((result) => {
            const resultDiv = document.createElement("div");
            resultDiv.className = "search-result";

            const highlightedSnippet = this.highlightQuery(result.snippet, this.currentQuery);
            const ancestorPath = this.formatAncestors(result.ancestors || []);

            resultDiv.innerHTML = `
                <a href="${result.url}" target="_blank" class="result-link">
                    <strong>${result.title}</strong>
                    <p style="color: gray; font-size: 0.7em;">${ancestorPath}</p>
                    <p>${highlightedSnippet}</p>
                </a>
            `;

            this.resultsContainer?.appendChild(resultDiv);
        });

        this.loading = false; // Allow new requests
    }

    private highlightQuery(text: string, query: string): string {
        const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(${safeQuery})`, "gi"); // Case-insensitive match
        return text.replace(regex, "<strong>$1</strong>");
    }

    private formatAncestors(ancestors: Array<{ type: string; id: string; text: string }>): string {
        const ancestorTitles = ancestors.map((ancestor) => ancestor.text);
        const fullPath = ancestorTitles.join(" > ");
        const maxLength = 130;

        if (fullPath.length > maxLength) {
            return "..." + fullPath.slice(fullPath.length - maxLength);
        }

        return fullPath;
    }

    private clearResults(): void {
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = "";
        }
    }
}

new SearchBar();