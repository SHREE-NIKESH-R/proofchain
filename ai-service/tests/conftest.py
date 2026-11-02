import pytest
import mongomock
from app.db import EmbeddingRepository


@pytest.fixture
def repository():
    client = mongomock.MongoClient()
    db = client["proofchain_test"]
    return EmbeddingRepository(db["embeddings"])
