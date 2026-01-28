import re
from typing import List

def normalize_ws(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def chunk_text(text: str, max_chars: int = 1200, overlap: int = 150) -> List[str]:
    """
    Chunk by paragraphs; then pack into ~max_chars with overlap.
    This is simple but works well for Phase 1.
    """
    text = normalize_ws(text)
    if not text:
        return []

    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: List[str] = []
    buf = ""

    for p in paras:
        if len(buf) + len(p) + 2 <= max_chars:
            buf = (buf + "\n\n" + p).strip() if buf else p
        else:
            if buf:
                chunks.append(buf)
            buf = p

    if buf:
        chunks.append(buf)

    # add overlap by tail characters
    if overlap > 0 and len(chunks) > 1:
        out: List[str] = []
        prev_tail = ""
        for c in chunks:
            merged = (prev_tail + "\n" + c).strip() if prev_tail else c
            out.append(merged)
            prev_tail = c[-overlap:] if len(c) > overlap else c
        return out

    return chunks