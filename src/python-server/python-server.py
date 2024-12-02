import asyncio
import websockets
import json
from datrie import Trie
import re
import hashlib

# Load index and metadata
INDEX = Trie.load("index/index.trie")
with open("index/paragraph_metadata.json", "r") as f:
    PARAGRAPH_METADATA = json.load(f)

async def search_handler(websocket, path):
    """
    WebSocket handler for real-time search.
    """
    print("Client connected")
    try:
        async for message in websocket:
            query = message.strip().lower()
            if query:
                results = search_query(query)
                await websocket.send(json.dumps(results))
            else:
                await websocket.send(json.dumps([]))
    except websockets.ConnectionClosed:
        print("Client disconnected")

def search_query(query, top_k=10):
    """
    Perform a search query on the trie and return top K results, with
    the query highlighted in the snippet.
    """
    if query in INDEX:
        paragraph_ids = INDEX[query]
        results = []
        for paragraph_id in paragraph_ids[:top_k]:
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
                # Default to first 200 chars if no match found
                snippet = cleaned_text[:200]
                highlighted_snippet = snippet  # No highlighting if query is not found

            results.append({
                "paragraph_id": paragraph_id,
                "title": metadata.get("title", "Untitled"),
                "url": metadata.get("url", ""),
                "snippet": highlighted_snippet
            })
        return results
    return []

# Start the WebSocket server
start_server = websockets.serve(search_handler, "0.0.0.0", 8765)

if __name__ == "__main__":
    print("Starting WebSocket server on ws://0.0.0.0:8765")
    asyncio.get_event_loop().run_until_complete(start_server)
    asyncio.get_event_loop().run_forever()