from app.db import EmbeddingRepository
from app.similarity.compare import cosine_similarity, top_matches
from app.scoring.originality import build_originality_result
from app.models.schemas import OriginalityResult
from app.text.embedding import get_text_embedding as default_get_text_embedding


def analyze_text(
    asset_id: str,
    text: str,
    content_type: str,
    repository: EmbeddingRepository,
    embedding_fn=default_get_text_embedding,
    persist: bool = True,
) -> OriginalityResult:
    """
    Prompt/Article pipeline (spec Sections 4.1 / 4.2):
      text -> preprocessing -> embedding -> compare against registered embeddings
      of the SAME content_type -> cosine similarity.

    `embedding_fn` is injected so tests can supply a deterministic stub instead of
    loading the real Sentence-Transformers model.
    """
    vector = embedding_fn(text)

    existing = repository.find_all_by_type(content_type, exclude_asset_id=asset_id)
    scored = [
        {"assetId": doc["assetId"], "score": cosine_similarity(vector, doc["vector"])}
        for doc in existing
    ]
    matches = top_matches(scored, top_k=5)

    # Persist this asset's embedding so future registrations can be compared against it.
    # `persist=False` is used for ad-hoc similarity checks (e.g. the Verify page probing
    # content that isn't being registered) so those never pollute the embeddings collection.
    if persist:
        repository.save(asset_id, content_type, vector)

    method = "Semantic Embedding"
    return build_originality_result(matches, method, registered_count=len(existing))
