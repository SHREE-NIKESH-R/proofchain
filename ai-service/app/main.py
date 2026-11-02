from fastapi import FastAPI
from app.routes.analyze import router as analyze_router

app = FastAPI(
    title="ProofChain Originality Engine",
    description=(
        "Content-specific similarity analysis for AI-generated Prompts, Articles, Images, "
        "Music, and Video. Produces technical similarity evidence, not legal determinations."
    ),
    version="0.2.0",
)

app.include_router(analyze_router)


@app.get("/health")
def health():
    return {"status": "ok"}
