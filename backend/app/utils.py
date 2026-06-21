from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status


def to_object_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id")
    return ObjectId(value)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def serialize_value(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize_value(item) for key, item in value.items()}
    return value


def serialize_document(document):
    if not document:
        return None

    payload = {key: serialize_value(value) for key, value in document.items()}
    payload["id"] = payload.pop("_id")
    return payload
