from __future__ import annotations

import csv
from io import StringIO
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pymongo.errors import PyMongoError

from .db import get_db
from .utils import serialize_value


router = APIRouter(prefix="/analytics", tags=["analytics"])

PENDING_STATUSES = {
    "pending",
    "submitted",
    "survey_required",
    "surveyed",
    "legal_review",
    "on_hold",
    "needs_revision",
}
APPROVED_STATUSES = {"approved", "certificate_issued", "completed"}
REJECTED_STATUSES = {"rejected", "denied"}
UNDER_OBJECTION_STATUSES = {"under_objection", "objection_pending"}
FINAL_TASK_STATUSES = {"registrar_reviewed", "cancelled"}

_indexes_checked = False


def get_collections() -> dict[str, Any]:
    global _indexes_checked

    db = get_db()
    collections = {
        "land_applications": db["land_applications"],
        "parcels": db["parcels"],
        "applicants": db["applicants"],
        "staff_members": db["staff_members"],
        "survey_tasks": db["survey_tasks"],
        "survey_reports": db["survey_reports"],
        "certificates": db["certificates"],
        "performance_logs": db["performance_logs"],
    }

    if not _indexes_checked:
        ensure_indexes(collections)
        _indexes_checked = True

    return collections


def ensure_indexes(collections: dict[str, Any]) -> None:
    index_specs = [
        ("land_applications", [("status", 1)]),
        ("land_applications", [("workflow.current_state", 1)]),
        ("land_applications", [("application_type", 1)]),
        ("land_applications", [("parcel_ref.zone_id", 1)]),
        ("parcels", [("geometry", "2dsphere")]),
    ]

    for collection_name, spec in index_specs:
        try:
            collections[collection_name].create_index(spec)
        except PyMongoError:
            # Analytics must remain demo-safe even if old sample geometry cannot be indexed.
            continue


def count_by_status(collection, statuses: set[str]) -> int:
    return collection.count_documents(
        {
            "$or": [
                {"status": {"$in": sorted(statuses)}},
                {"workflow.current_state": {"$in": sorted(statuses)}},
            ]
        }
    )


def average_processing_days(collection) -> float | None:
    pipeline = [
        {
            "$project": {
                "submitted_at": {
                    "$ifNull": [
                        "$timestamps.submitted_at",
                        {"$ifNull": ["$submitted_at", "$created_at"]},
                    ]
                },
                "completed_at": {
                    "$ifNull": [
                        "$timestamps.closed_at",
                        {
                            "$ifNull": [
                                "$timestamps.approved_at",
                                {"$ifNull": ["$closed_at", "$approved_at"]},
                            ]
                        },
                    ]
                },
            }
        },
        {"$match": {"submitted_at": {"$type": "date"}, "completed_at": {"$type": "date"}}},
        {
            "$project": {
                "days": {
                    "$divide": [
                        {"$subtract": ["$completed_at", "$submitted_at"]},
                        1000 * 60 * 60 * 24,
                    ]
                }
            }
        },
        {"$match": {"days": {"$gte": 0}}},
        {"$group": {"_id": None, "average_days": {"$avg": "$days"}}},
    ]

    result = list(collection.aggregate(pipeline))
    if not result:
        return None
    return round(float(result[0].get("average_days", 0)), 2)


def grouped_counts(collection, key_expression: Any, output_key: str) -> list[dict[str, Any]]:
    pipeline = [
        {"$group": {"_id": key_expression, "count": {"$sum": 1}}},
        {"$project": {output_key: {"$ifNull": ["$_id", "unknown"]}, "count": 1, "_id": 0}},
        {"$sort": {"count": -1, output_key: 1}},
    ]
    return [serialize_value(item) for item in collection.aggregate(pipeline)]


def nested_value(document: dict[str, Any], dotted_key: str) -> Any:
    value: Any = document
    for key in dotted_key.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def normalized_geometry(parcel: dict[str, Any]) -> dict[str, Any] | None:
    geometry = parcel.get("geometry")
    if isinstance(geometry, dict) and geometry.get("type") == "Feature":
        geometry = geometry.get("geometry")
    if not isinstance(geometry, dict):
        return None
    if not geometry.get("type") or "coordinates" not in geometry:
        return None
    return serialize_value(geometry)


def parcel_feature(parcel: dict[str, Any], extra_properties: dict[str, Any] | None = None) -> dict[str, Any] | None:
    geometry = normalized_geometry(parcel)
    if not geometry:
        return None

    properties = {
        "parcel_id": str(parcel.get("_id") or parcel.get("parcel_id") or ""),
        "parcel_code": parcel.get("parcel_code"),
        "parcel_number": parcel.get("parcel_number"),
        "zone_id": parcel.get("zone_id"),
        "registration_status": parcel.get("registration_status"),
        "dispute_state": parcel.get("dispute_state"),
        "land_use": parcel.get("land_use"),
        "area_sqm": parcel.get("area_sqm"),
    }
    if extra_properties:
        properties.update(extra_properties)

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": serialize_value(properties),
    }


def feature_collection(features: list[dict[str, Any]]) -> dict[str, Any]:
    return {"type": "FeatureCollection", "features": features}


@router.get("/kpis")
def get_kpis(collections=Depends(get_collections)):
    applications = collections["land_applications"]
    return {
        "total_applications": applications.count_documents({}),
        "pending_applications": count_by_status(applications, PENDING_STATUSES),
        "approved_applications": count_by_status(applications, APPROVED_STATUSES),
        "rejected_applications": count_by_status(applications, REJECTED_STATUSES),
        "under_objection_applications": count_by_status(applications, UNDER_OBJECTION_STATUSES),
        "certificates_issued": collections["certificates"].count_documents({}),
        "average_processing_days": average_processing_days(applications),
    }


@router.get("/applications-by-status")
def applications_by_status(collections=Depends(get_collections)):
    return grouped_counts(
        collections["land_applications"],
        {"$ifNull": ["$status", "$workflow.current_state"]},
        "status",
    )


@router.get("/applications-by-type")
def applications_by_type(collections=Depends(get_collections)):
    return grouped_counts(collections["land_applications"], "$application_type", "application_type")


@router.get("/applications-by-zone")
def applications_by_zone(collections=Depends(get_collections)):
    return grouped_counts(
        collections["land_applications"],
        {"$ifNull": ["$parcel_ref.zone_id", "$zone_id"]},
        "zone_id",
    )


@router.get("/processing-time")
def processing_time(collections=Depends(get_collections)):
    pipeline = [
        {
            "$project": {
                "application_type": {"$ifNull": ["$application_type", "unknown"]},
                "submitted_at": {
                    "$ifNull": [
                        "$timestamps.submitted_at",
                        {"$ifNull": ["$submitted_at", "$created_at"]},
                    ]
                },
                "completed_at": {
                    "$ifNull": [
                        "$timestamps.closed_at",
                        {
                            "$ifNull": [
                                "$timestamps.approved_at",
                                {"$ifNull": ["$closed_at", "$approved_at"]},
                            ]
                        },
                    ]
                },
            }
        },
        {"$match": {"submitted_at": {"$type": "date"}, "completed_at": {"$type": "date"}}},
        {
            "$project": {
                "application_type": 1,
                "processing_days": {
                    "$divide": [
                        {"$subtract": ["$completed_at", "$submitted_at"]},
                        1000 * 60 * 60 * 24,
                    ]
                },
            }
        },
        {"$match": {"processing_days": {"$gte": 0}}},
        {
            "$group": {
                "_id": "$application_type",
                "average_processing_days": {"$avg": "$processing_days"},
                "count": {"$sum": 1},
            }
        },
        {
            "$project": {
                "_id": 0,
                "application_type": "$_id",
                "average_processing_days": {"$round": ["$average_processing_days", 2]},
                "count": 1,
            }
        },
        {"$sort": {"average_processing_days": -1}},
    ]
    return [serialize_value(item) for item in collections["land_applications"].aggregate(pipeline)]


@router.get("/surveyors")
def surveyors(collections=Depends(get_collections)):
    task_pipeline = [
        {
            "$group": {
                "_id": "$assigned_surveyor_id",
                "active_tasks": {
                    "$sum": {"$cond": [{"$not": [{"$in": ["$status", list(FINAL_TASK_STATUSES)]}]}, 1, 0]}
                },
                "completed_tasks": {
                    "$sum": {"$cond": [{"$eq": ["$status", "registrar_reviewed"]}, 1, 0]}
                },
                "total_tasks": {"$sum": 1},
            }
        },
    ]
    task_counts = {
        str(item["_id"]): item
        for item in collections["survey_tasks"].aggregate(task_pipeline)
        if item.get("_id")
    }

    records = []
    for staff in collections["staff_members"].find({"role": "surveyor"}).sort("staff_code", 1):
        counts = task_counts.get(str(staff["_id"]), {})
        records.append(
            {
                "staff_id": str(staff["_id"]),
                "staff_code": staff.get("staff_code"),
                "name": staff.get("name"),
                "active_tasks": counts.get("active_tasks", staff.get("workload", {}).get("active_tasks", 0)),
                "completed_tasks": counts.get("completed_tasks", 0),
                "total_tasks": counts.get("total_tasks", 0),
            }
        )

    return records


@router.get("/registrars")
def registrars(collections=Depends(get_collections)):
    workload: dict[str, int] = {}

    application_pipeline = [
        {"$match": {"assignment.assigned_registrar_id": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$assignment.assigned_registrar_id", "count": {"$sum": 1}}},
    ]
    for item in collections["land_applications"].aggregate(application_pipeline):
        workload[str(item["_id"])] = workload.get(str(item["_id"]), 0) + item["count"]

    task_pipeline = [
        {"$match": {"registrar_review.registrar_staff_id": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$registrar_review.registrar_staff_id", "count": {"$sum": 1}}},
    ]
    for item in collections["survey_tasks"].aggregate(task_pipeline):
        workload[str(item["_id"])] = workload.get(str(item["_id"]), 0) + item["count"]

    return [
        {"registrar_id": registrar_id, "workload_count": count}
        for registrar_id, count in sorted(workload.items(), key=lambda item: item[1], reverse=True)
    ]


@router.get("/geofeeds/parcels")
def parcels_geojson(collections=Depends(get_collections)):
    features = []
    for parcel in collections["parcels"].find({}):
        feature = parcel_feature(parcel)
        if feature:
            features.append(feature)
    return feature_collection(features)


@router.get("/geofeeds/pending-heatmap")
def pending_heatmap(collections=Depends(get_collections)):
    pending_query = {
        "$or": [
            {"status": {"$in": sorted(PENDING_STATUSES)}},
            {"workflow.current_state": {"$in": sorted(PENDING_STATUSES)}},
        ]
    }
    pending_applications = list(collections["land_applications"].find(pending_query))

    parcel_values: set[str] = set()
    object_ids: set[ObjectId] = set()
    application_by_parcel_value: dict[str, dict[str, Any]] = {}

    for application in pending_applications:
        parcel_ref = application.get("parcel_ref") if isinstance(application.get("parcel_ref"), dict) else {}
        values = [
            parcel_ref.get("parcel_id"),
            parcel_ref.get("parcel_number"),
            parcel_ref.get("parcel_code"),
            application.get("parcel_number"),
        ]
        for raw_value in values:
            if raw_value is None:
                continue
            value = str(raw_value)
            parcel_values.add(value)
            application_by_parcel_value.setdefault(value, application)
            if ObjectId.is_valid(value):
                object_ids.add(ObjectId(value))

    if not parcel_values and not object_ids:
        return feature_collection([])

    match_conditions: list[dict[str, Any]] = [
        {"parcel_id": {"$in": list(parcel_values)}},
        {"parcel_code": {"$in": list(parcel_values)}},
        {"parcel_number": {"$in": list(parcel_values)}},
    ]
    if object_ids:
        match_conditions.extend(
            [
                {"_id": {"$in": list(object_ids)}},
                {"parcel_id": {"$in": list(object_ids)}},
            ]
        )

    features = []
    for parcel in collections["parcels"].find({"$or": match_conditions}):
        lookup_keys = [
            str(parcel.get("_id")),
            str(parcel.get("parcel_id")),
            str(parcel.get("parcel_code")),
            str(parcel.get("parcel_number")),
        ]
        application = next((application_by_parcel_value[key] for key in lookup_keys if key in application_by_parcel_value), None)
        extra_properties = {}
        if application:
            extra_properties = {
                "application_id": str(application.get("_id")),
                "application_type": application.get("application_type"),
                "status": application.get("status") or nested_value(application, "workflow.current_state"),
                "zone_id": nested_value(application, "parcel_ref.zone_id") or application.get("zone_id") or parcel.get("zone_id"),
            }
        feature = parcel_feature(parcel, extra_properties)
        if feature:
            features.append(feature)

    return feature_collection(features)


@router.get("/export/applications.csv")
def export_applications_csv(collections=Depends(get_collections)):
    buffer = StringIO()
    writer = csv.DictWriter(
        buffer,
        fieldnames=[
            "application_id",
            "application_type",
            "status",
            "zone_id",
            "submitted_at",
            "approved_at",
            "closed_at",
        ],
    )
    writer.writeheader()

    for application in collections["land_applications"].find({}).sort("created_at", -1):
        writer.writerow(
            {
                "application_id": str(application.get("_id")),
                "application_type": application.get("application_type"),
                "status": application.get("status") or nested_value(application, "workflow.current_state"),
                "zone_id": nested_value(application, "parcel_ref.zone_id") or application.get("zone_id"),
                "submitted_at": serialize_value(nested_value(application, "timestamps.submitted_at") or application.get("submitted_at") or application.get("created_at")),
                "approved_at": serialize_value(nested_value(application, "timestamps.approved_at") or application.get("approved_at")),
                "closed_at": serialize_value(nested_value(application, "timestamps.closed_at") or application.get("closed_at")),
            }
        )

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=applications.csv"},
    )
