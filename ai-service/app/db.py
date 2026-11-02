"""
Embedding storage.

Per the product spec (Section 28), embeddings are NOT put on the blockchain and do NOT
require a dedicated vector database for the MVP — a MongoDB collection with brute-force
cosine similarity is an explicit, accepted tradeoff. This module keeps that decision
isolated behind a repository interface so it can be swapped for something like a proper
vector index later without touching the analysis pipelines that call it.
"""
from typing import Optional
from pymongo import MongoClient
from pymongo.collection import Collection

from app.config import settings


class EmbeddingRepository:
    """Thin wrapper around the `embeddings` collection."""

    def __init__(self, collection: Collection):
        self._collection = collection

    def save(self, asset_id: str, content_type: str, vector: list[float], extra: Optional[dict] = None) -> None:
        doc = {
            "assetId": asset_id,
            "contentType": content_type,
            "vector": vector,
            "extra": extra or {},
        }
        self._collection.update_one({"assetId": asset_id}, {"$set": doc}, upsert=True)

    def find_all_by_type(self, content_type: str, exclude_asset_id: Optional[str] = None) -> list[dict]:
        query = {"contentType": content_type}
        if exclude_asset_id:
            query["assetId"] = {"$ne": exclude_asset_id}
        return list(self._collection.find(query))

    def get(self, asset_id: str) -> Optional[dict]:
        return self._collection.find_one({"assetId": asset_id})


_client: Optional[MongoClient] = None


def get_embedding_repository() -> EmbeddingRepository:
    """FastAPI dependency — returns a repository backed by the real MongoDB connection."""
    global _client
    if _client is None:
        # Fail fast rather than hanging indefinitely if MongoDB is unreachable —
        # pymongo's default server selection timeout is 30s, which would otherwise
        # make every request appear to hang rather than error clearly.
        _client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
    db = _client.get_default_database()
    return EmbeddingRepository(db["embeddings"])
