import os
from functools import lru_cache

from pymongo import MongoClient
from pymongo.database import Database


@lru_cache(maxsize=1)
def get_client() -> MongoClient:
    return MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"), tz_aware=True)


def get_db() -> Database:
    db_name = os.getenv("MONGO_DB_NAME", "lrm_is_db")
    return get_client()[db_name]
