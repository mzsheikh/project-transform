import os
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer
from typing import List

load_dotenv()

MODEL_NAME = os.getenv("EMBED_MODEL", "BAAI/bge-small-en-v1.5")

# Load once at import time (FastAPI process startup)
_model = SentenceTransformer(MODEL_NAME)

def embed_texts(texts: List[str]) -> List[List[float]]:
    # bge works well with normalize_embeddings=True for cosine similarity
    emb = _model.encode(
        texts,
        batch_size=32,
        show_progress_bar=False,
        normalize_embeddings=True,
    )
    # Ensure pure python lists for SQLAlchemy/pgvector
    return [v.tolist() for v in emb]