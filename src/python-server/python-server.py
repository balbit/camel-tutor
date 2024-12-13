import asyncio
import websockets
import json
from datrie import Trie
import re
import hashlib
from unicodedata import normalize

# Load index and metadata
INDEX = Trie.load("index/index.trie")
with open("index/paragraph_metadata.json", "r") as f:
    PARAGRAPH_METADATA = json.load(f)

def clean_text(text):
    """Normalize text: lowercase, remove punctuation, and clean whitespace."""
    text = text.lower()
    text = text.replace('-', ' ')
    text = re.sub(r'[^\w\s_]', '', text)  # Remove punctuation but keep underscores
    text = normalize('NFKD', text).encode('ascii', 'ignore').decode()  # Remove accents
    text = re.sub(r'\s+', ' ', text).strip()  # Normalize whitespace
    return text

async def search_handler(websocket, path):
    """
    WebSocket handler for real-time search.
    """
    print("Client connected")
    try:
        async for message in websocket:
            data = json.loads(message)
            query = clean_text(data.get("query", "").strip())
            offset = int(data.get("offset", 0))  # Get the offset
            if query:
                results = search_query(query, offset=offset, top_k=10)
                await websocket.send(json.dumps(results))
            else:
                await websocket.send(json.dumps([]))
    except websockets.ConnectionClosed:
        print("Client disconnected")


def normalize_text(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', '', text)
    text = text.strip()
    text = re.sub(r'\s+', ' ', text)
    words = text.split()
    words = words[:6]
    return '-'.join(words)

def get_element_url(metadata):
    tag = metadata.get("type", "").lower()
    text_content = metadata.get("raw_text", "")
    normalized_text = normalize_text(text_content)
    base_url = metadata.get("url", "")
    return base_url + "#" + "-".join([tag, normalized_text])

def search_query(query, offset=0, top_k=10):
    """
    Perform a search query on the trie and return top K results, starting at the given offset.
    """
    if query in INDEX:
        paragraph_ids = INDEX[query]
        # Deduplicate paragraph_ids
        paragraph_ids = list(dict.fromkeys(paragraph_ids))
        results = []
        for paragraph_id in paragraph_ids[offset:offset + top_k]:
            metadata = PARAGRAPH_METADATA.get(paragraph_id, {})
            cleaned_text = metadata.get("cleaned_text", "")

            # Search for the query in the cleaned text
            match = re.search(re.escape(query), cleaned_text, re.IGNORECASE)
            if match:
                start = max(match.start() - 50, 0)  # Include 50 chars before the match
                end = min(match.end() + 50, len(cleaned_text))  # Include 50 chars after the match
                snippet = cleaned_text[start:end]
                highlighted_snippet = re.sub(
                    re.escape(query),
                    lambda m: f"<strong>{m.group(0)}</strong>",
                    snippet,
                    flags=re.IGNORECASE
                )
            else:
                snippet = cleaned_text[:200]
                highlighted_snippet = snippet  # No highlighting if query is not found

            results.append({
                "paragraph_id": paragraph_id,
                "title": metadata.get("title", "Untitled"),
                "url": get_element_url(metadata),
                "snippet": highlighted_snippet,
                "ancestors": metadata.get("ancestors", [])
            })
        return results
    return []

# Start the WebSocket server
start_server = websockets.serve(search_handler, "0.0.0.0", 8765)

if __name__ == "__main__":
    print("Starting WebSocket server on ws://0.0.0.0:8765")
    asyncio.get_event_loop().run_until_complete(start_server)
    asyncio.get_event_loop().run_forever()