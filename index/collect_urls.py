import requests
from bs4 import BeautifulSoup
import json
from urllib.parse import urljoin, urlparse

BASE_URL = "https://camel.elliotliu.com/"

def collect_urls(base_url):
    visited = set()  # Keep track of visited URLs
    queue = [base_url]  # Start with the base URL
    collected_urls = []

    while queue:
        current_url = queue.pop(0)

        if current_url in visited:
            continue  # Skip if already visited
        visited.add(current_url)

        print(f"Visiting: {current_url}")
        try:
            response = requests.get(current_url)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"Error visiting {current_url}: {e}")
            continue

        soup = BeautifulSoup(response.text, "html.parser")
        for link in soup.find_all("a", href=True):
            href = link["href"]
            # Resolve relative URLs
            full_url = urljoin(current_url, href)
            # Ensure it's within the same subdomain
            if full_url.startswith(BASE_URL):
                # Get the relative path
                parsed_url = urlparse(full_url)
                relative_path = parsed_url.path.lstrip("/")
                if relative_path not in collected_urls and not relative_path.endswith("/"):
                    collected_urls.append(relative_path)
                    queue.append(full_url)

    return collected_urls

if __name__ == "__main__":
    urls = collect_urls(f"{BASE_URL}index.html")
    with open("index_pages.json", "w") as f:
        json.dump(urls, f, indent=2)
    print(f"Collected {len(urls)} URLs and saved to index_pages.json.")
