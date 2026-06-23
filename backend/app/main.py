from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .analytics import router as analytics_router
from .db import get_client, get_db
from .routes import router


load_dotenv()

app = FastAPI(title="LRMIS Applicant Portal API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(analytics_router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "LRMIS API is running"}


@app.get("/health/db")
def database_health():
    get_client().admin.command("ping")
    db = get_db()
    return {
        "mongodb_connected": True,
        "database": db.name,
        "collections": db.list_collection_names(),
    }
