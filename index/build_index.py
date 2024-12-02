import requests
from bs4 import BeautifulSoup
import re
import json
import datrie
from unicodedata import normalize
from urllib.parse import urljoin
import hashlib

RWO_URL = "https://dev.realworldocaml.org/"
BASE_URL = "https://camel.elliotliu.com/"

ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789 "
INDEX = datrie.Trie(ALPHABET)

paragraph_metadata = {}

def clean_text(text):
    """Normalize text: lowercase, remove punctuation, and clean whitespace."""
    text = text.lower()
    text = text.replace('-', ' ')
    # Remove html tags
    text = re.sub(r'<[^>]*>', '', text)
    text = re.sub(r'[^\w\s_]', '', text)  # Remove punctuation but keep underscores
    text = normalize('NFKD', text).encode('ascii', 'ignore').decode()  # Remove accents
    text = re.sub(r'\s+', ' ', text).strip()  # Normalize whitespace
    return text

def fetch_and_extract(url):
    """Fetch a webpage and extract meaningful content using BeautifulSoup."""
    response = requests.get(url)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, 'html.parser')
    title = soup.title.string if soup.title else 'No title'
    
    elements = []
    for i, element in enumerate(soup.find_all(['h1', 'h2', 'p', 'li'])):
        parent_sections = element.find_parents('section')
        section_titles = []
        for section in parent_sections:
            section_class = section.get("class", [])
            heading = None
            for level in range(1, 5):
                if f"level{level}" in section_class:
                    heading = section.find(f'h{level}')
                    break

            if heading:
                section_titles.append({
                    "type": heading.name,
                    "id": section.get("id", None),  # ID of the section, if present
                    "text": heading.get_text(strip=False)  # Section title
                })

        # Reverse to maintain the hierarchy (outermost -> innermost)
        section_titles.reverse()

        elements.append({
            "title": title,
            "ancestors": section_titles,
            "type": element.name,
            "id": element.get("id", None),  # Retain IDs for anchors if present
            "order": i,  # Track DOM order
            "text": element.get_text(strip=False)
        })
    return elements

def generate_word_chunks(text, max_chunk_size=15, max_substring_length=20):
    """
    Break text into overlapping word chunks and substrings for efficient indexing.
    - Chunks up to `max_chunk_size` words.
    - Substrings up to `max_substring_length` characters.
    """
    words = text.split()
    chunks = []

    # Generate overlapping word chunks
    for size in range(1, min(max_chunk_size, len(words)) + 1):
        for i in range(len(words) - size + 1):
            chunks.append(" ".join(words[i:i + size]))

    # Add shorter substrings
    for i in range(len(text)):
        for j in range(i + 1, min(i + max_substring_length + 1, len(text) + 1)):
            chunks.append(text[i:j])

    return set(chunks)  # Remove duplicates

def build_index(urls):
    """Build an optimized index with paragraph IDs and metadata."""
    for url in urls:
        full_url = urljoin(BASE_URL, url)
        print(f"Processing: {full_url}")
        elements = fetch_and_extract(full_url)

        for element in elements:
            print(f"Working on element: - {element['type']}")
            raw_text = element["text"]
            cleaned_text = clean_text(raw_text)
            
            # Generate a unique ID for the paragraph
            paragraph_id = hashlib.md5(cleaned_text.encode()).hexdigest()

            # Store metadata for the paragraph
            paragraph_metadata[paragraph_id] = {
                "url": full_url,
                "type": element["type"],
                "order": element["order"],
                "id": element.get("id", None),
                "ancestors": element["ancestors"],
                "title": element["title"],
                "raw_text": raw_text,
                "cleaned_text": cleaned_text
            }

            # Generate chunks for indexing
            tokens = generate_word_chunks(cleaned_text)

            # Map each token to the paragraph ID
            for token in tokens:
                if token in INDEX:
                    INDEX[token].append(paragraph_id)
                else:
                    INDEX[token] = [paragraph_id]

    # Save the index and metadata
    INDEX.save("index.trie")
    with open("paragraph_metadata.json", "w") as f:
        json.dump(paragraph_metadata, f, indent=2)
    print("Index and metadata saved.")

def load_index():
    """Load the pre-built index from disk."""
    global INDEX, paragraph_metadata
    INDEX.load("index.trie")
    with open("paragraph_metadata.json", "r") as f:
        paragraph_metadata = json.load(f)

def interactive_query():
    """
    Allows interactive querying of the built trie.
    """
    print("Interactive Trie Query Tool")
    print("Type 'exit' to quit.")
    
    while True:
        query = input("Enter a search term: ").strip().lower()
        if query == "exit":
            break
        
        if query in INDEX:
            print(f"Results for '{query}':")
            for result in INDEX[query]:
                print(json.dumps(result, indent=2))
        else:
            print(f"No results found for '{query}'.")

if __name__ == "__main__":
    try:
        with open("index_pages.json", "r") as f:
            urls = json.load(f)
    except FileNotFoundError:
        print("Error: index_pages.json not found. Run the URL collection script first.")
        exit(1)

    # Index all URLs
    try:
        load_index()
        print("Index loaded from disk.")
    except FileNotFoundError:
        print("No existing index found. Building a new one.")
        build_index(urls)
    
    # Start the interactive query session
    interactive_query()
