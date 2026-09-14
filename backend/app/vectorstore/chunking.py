"""Plain character-based chunking with overlap - no tokenizer dependency.
Good enough for splitting document text into pieces small enough to embed
and retrieve individually, instead of dumping a whole file into one prompt.
"""

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150

# Cap how much source text we'll ever chunk+embed for one upload, so a huge
# file can't blow up embedding cost/time. Generous for lecture notes/papers.
MAX_CHUNK_SOURCE_CHARS = 200_000


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    text = text.strip()[:MAX_CHUNK_SOURCE_CHARS]
    if not text:
        return []

    chunks: list[str] = []
    start = 0
    length = len(text)
    while start < length:
        end = min(start + chunk_size, length)
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end == length:
            break
        start = end - overlap
    return chunks
