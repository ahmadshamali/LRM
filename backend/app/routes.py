import os
from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from .db import get_db
from .schemas import (
    ApplicantCreate,
    ApplicationCreate,
    AutoAssignSurveyorRequest,
    CommentCreate,
    DocumentCreate,
    ObjectionCreate,
    RegistrarReviewCreate,
    StaffCreate,
    StaffRole,
    SurveyMilestoneUpdate,
    SurveyReportCreate,
)
from .utils import serialize_document, to_object_id, utc_now


router = APIRouter()


SURVEY_MILESTONE_ORDER = [
    "assigned",
    "visit_scheduled",
    "arrived_on_site",
    "survey_started",
    "survey_completed",
    "report_uploaded",
    "registrar_reviewed",
]


FINAL_TASK_STATUSES = {"registrar_reviewed", "cancelled"}


def get_collections():
    db = get_db()
    return {
        "applicants": db["applicants"],
        "land_applications": db["land_applications"],
        "application_documents": db["application_documents"],
        "objections": db["objections"],
        "application_comments": db["application_comments"],
        "staff_members": db["staff_members"],
        "survey_tasks": db["survey_tasks"],
        "survey_reports": db["survey_reports"],
        "performance_logs": db["performance_logs"],
    }


def require_staff_access(x_staff_token: Optional[str] = Header(default=None)) -> None:
    expected_token = os.getenv("STAFF_API_TOKEN", "staff-secret")
    if x_staff_token != expected_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required. Send x-staff-token header.",
        )


def add_performance_event(
    collections,
    application_object_id: ObjectId,
    event_type: str,
    actor_type: str,
    actor_id: str,
    meta: Optional[dict] = None,
) -> None:
    event = {
        "type": event_type,
        "by": {
            "actor_type": actor_type,
            "actor_id": actor_id,
        },
        "at": utc_now(),
        "meta": meta or {},
    }

    collections["performance_logs"].update_one(
        {"application_id": application_object_id},
        {
            "$setOnInsert": {
                "application_id": application_object_id,
                "created_at": utc_now(),
            },
            "$push": {"event_stream": event},
            "$set": {"updated_at": utc_now()},
        },
        upsert=True,
    )


def fetch_applicant_or_404(applicants_collection, applicant_id: str):
    applicant = applicants_collection.find_one({"_id": to_object_id(applicant_id)})
    if not applicant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Applicant not found")
    return applicant


def fetch_application_or_404(applications_collection, application_id: str):
    application = applications_collection.find_one({"_id": to_object_id(application_id)})
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return application


def fetch_staff_or_404(staff_collection, staff_id: str, required_role: Optional[StaffRole] = None):
    staff_member = staff_collection.find_one({"_id": to_object_id(staff_id)})
    if not staff_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")
    if required_role and staff_member.get("role") != required_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Staff member must have role: {required_role}",
        )
    return staff_member


def fetch_active_task_for_application_or_404(collections, application_object_id: ObjectId):
    task = collections["survey_tasks"].find_one(
        {
            "application_id": application_object_id,
            "status": {"$nin": list(FINAL_TASK_STATUSES)},
        }
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active survey task not found")
    return task


def ensure_application_owner(application, applicant_id: str) -> None:
    if application["applicant_id"] != to_object_id(applicant_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Applicant does not own this application",
        )


@router.post("/applicants", status_code=status.HTTP_201_CREATED)
def create_applicant(payload: ApplicantCreate, collections=Depends(get_collections)):
    document = payload.model_dump()
    document["created_at"] = utc_now()
    result = collections["applicants"].insert_one(document)
    created = collections["applicants"].find_one({"_id": result.inserted_id})
    return serialize_document(created)


@router.get("/applicants/{applicant_id}")
def get_applicant(applicant_id: str, collections=Depends(get_collections)):
    applicant = fetch_applicant_or_404(collections["applicants"], applicant_id)
    return serialize_document(applicant)


@router.post("/applications", status_code=status.HTTP_201_CREATED)
def create_application(payload: ApplicationCreate, collections=Depends(get_collections)):
    fetch_applicant_or_404(collections["applicants"], payload.applicant_id)

    now = utc_now()
    document = payload.model_dump()
    document["applicant_id"] = to_object_id(payload.applicant_id)
    document["status"] = "submitted"
    document["created_at"] = now
    document["updated_at"] = now
    document["assignment"] = {
        "assigned_surveyor_id": None,
        "assignment_policy": None,
    }

    result = collections["land_applications"].insert_one(document)
    created = collections["land_applications"].find_one({"_id": result.inserted_id})

    add_performance_event(
        collections,
        result.inserted_id,
        "application_submitted",
        "applicant",
        payload.applicant_id,
        {"application_type": payload.application_type, "zone_id": payload.zone_id},
    )

    return serialize_document(created)


@router.get("/applicants/{applicant_id}/applications")
def list_applications(applicant_id: str, collections=Depends(get_collections)):
    fetch_applicant_or_404(collections["applicants"], applicant_id)
    records = list(collections["land_applications"].find({"applicant_id": to_object_id(applicant_id)}).sort("created_at", -1))
    return [serialize_document(record) for record in records]


@router.get("/applications")
def list_shared_applications(
    applicant_id: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    application_type: Optional[str] = None,
    zone_id: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=25, ge=1, le=100),
    sort_by: Literal["created_at", "updated_at", "status", "application_type", "zone_id"] = "created_at",
    sort_order: Literal["asc", "desc"] = "desc",
    collections=Depends(get_collections),
):
    query = {}
    if applicant_id:
        query["applicant_id"] = to_object_id(applicant_id)
    if status_filter:
        query["status"] = status_filter
    if application_type:
        query["application_type"] = application_type
    if zone_id:
        query["zone_id"] = zone_id

    sort_direction = 1 if sort_order == "asc" else -1
    cursor = (
        collections["land_applications"]
        .find(query)
        .sort(sort_by, sort_direction)
        .skip(skip)
        .limit(limit)
    )
    return [serialize_document(record) for record in cursor]


@router.get("/applications/{application_id}")
def get_application(application_id: str, collections=Depends(get_collections)):
    application = fetch_application_or_404(collections["land_applications"], application_id)
    return serialize_document(application)


@router.post("/applications/{application_id}/documents", status_code=status.HTTP_201_CREATED)
def add_document(application_id: str, payload: DocumentCreate, collections=Depends(get_collections)):
    application = fetch_application_or_404(collections["land_applications"], application_id)
    fetch_applicant_or_404(collections["applicants"], payload.uploaded_by_applicant_id)
    ensure_application_owner(application, payload.uploaded_by_applicant_id)

    document = payload.model_dump()
    document["application_id"] = to_object_id(application_id)
    document["uploaded_by_applicant_id"] = to_object_id(payload.uploaded_by_applicant_id)
    document["status"] = "pending_review"
    document["uploaded_at"] = utc_now()

    result = collections["application_documents"].insert_one(document)
    created = collections["application_documents"].find_one({"_id": result.inserted_id})

    add_performance_event(
        collections,
        application["_id"],
        "document_uploaded",
        "applicant",
        payload.uploaded_by_applicant_id,
        {"document_type": payload.document_type, "filename": payload.filename},
    )

    return serialize_document(created)


@router.post("/applications/{application_id}/comments", status_code=status.HTTP_201_CREATED)
def add_comment(application_id: str, payload: CommentCreate, collections=Depends(get_collections)):
    application = fetch_application_or_404(collections["land_applications"], application_id)
    fetch_applicant_or_404(collections["applicants"], payload.applicant_id)
    ensure_application_owner(application, payload.applicant_id)

    document = payload.model_dump()
    document["application_id"] = to_object_id(application_id)
    document["applicant_id"] = to_object_id(payload.applicant_id)
    document["created_at"] = utc_now()

    result = collections["application_comments"].insert_one(document)
    created = collections["application_comments"].find_one({"_id": result.inserted_id})

    add_performance_event(
        collections,
        application["_id"],
        "comment_added",
        "applicant",
        payload.applicant_id,
        {"comment_text": payload.comment_text},
    )

    return serialize_document(created)


@router.post("/applications/{application_id}/objections", status_code=status.HTTP_201_CREATED)
def add_objection(application_id: str, payload: ObjectionCreate, collections=Depends(get_collections)):
    application = fetch_application_or_404(collections["land_applications"], application_id)
    fetch_applicant_or_404(collections["applicants"], payload.applicant_id)

    document = payload.model_dump()
    document["application_id"] = to_object_id(application_id)
    document["applicant_id"] = to_object_id(payload.applicant_id)
    document["status"] = "pending"
    document["created_at"] = utc_now()

    result = collections["objections"].insert_one(document)
    created = collections["objections"].find_one({"_id": result.inserted_id})

    collections["land_applications"].update_one(
        {"_id": application["_id"]},
        {
            "$set": {"status": "under_objection", "updated_at": utc_now()},
            "$push": {"objection_ids": result.inserted_id},
        },
    )

    add_performance_event(
        collections,
        application["_id"],
        "objection_submitted",
        "applicant",
        payload.applicant_id,
        {"reason": payload.reason},
    )

    return serialize_document(created)


@router.get("/applications/{application_id}/timeline")
def get_timeline(application_id: str, collections=Depends(get_collections)):
    application = fetch_application_or_404(collections["land_applications"], application_id)
    application_object_id = to_object_id(application_id)

    events = [
        {
            "event_type": "application_submitted",
            "title": "Application submitted",
            "timestamp": application["created_at"],
            "details": {
                "application_type": application["application_type"],
                "status": "submitted",
            },
        }
    ]

    if application.get("status") != "submitted" and application.get("updated_at"):
        events.append(
            {
                "event_type": "application_status_changed",
                "title": f"Application status: {application['status']}",
                "timestamp": application["updated_at"],
                "details": {"status": application["status"]},
            }
        )

    for document in collections["application_documents"].find({"application_id": application_object_id}):
        events.append(
            {
                "event_type": "document_uploaded",
                "title": f"Document uploaded: {document.get('filename', 'Document')}",
                "timestamp": document["uploaded_at"],
                "details": {
                    "document_type": document.get("document_type"),
                    "status": document.get("status"),
                    "filename": document.get("filename"),
                },
            }
        )

    for comment in collections["application_comments"].find({"application_id": application_object_id}):
        events.append(
            {
                "event_type": "comment_added",
                "title": "Comment added",
                "timestamp": comment["created_at"],
                "details": {"comment_text": comment.get("comment_text")},
            }
        )

    for objection in collections["objections"].find({"application_id": application_object_id}):
        events.append(
            {
                "event_type": "objection_submitted",
                "title": "Objection submitted",
                "timestamp": objection["created_at"],
                "details": {
                    "reason": objection.get("reason"),
                    "status": objection.get("status"),
                    "supporting_document_filename": objection.get("supporting_document_filename"),
                },
            }
        )

    performance_log = collections["performance_logs"].find_one({"application_id": application_object_id})
    if performance_log:
        for event in performance_log.get("event_stream", []):
            if event.get("type") == "application_submitted":
                continue
            events.append(
                {
                    "event_type": event.get("type", "performance_event"),
                    "title": event.get("type", "performance_event").replace("_", " ").title(),
                    "timestamp": event.get("at"),
                    "details": event.get("meta", {}),
                }
            )

    events = [event for event in events if event.get("timestamp")]
    events.sort(key=lambda item: item["timestamp"])
    return [
        {
            "event_type": item["event_type"],
            "title": item["title"],
            "timestamp": item["timestamp"].isoformat(),
            "details": item["details"],
        }
        for item in events
    ]


# -----------------------------------------------------------------------------
# Student 3 routes: Surveyors, Registrar, and Assignment Module
# -----------------------------------------------------------------------------


@router.post("/staff", status_code=status.HTTP_201_CREATED)
def create_staff_member(
    payload: StaffCreate,
    collections=Depends(get_collections),
    _access: None = Depends(require_staff_access),
):
    existing = collections["staff_members"].find_one({"staff_code": payload.staff_code})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Staff code already exists")

    document = {
        "staff_code": payload.staff_code,
        "name": payload.name,
        "role": payload.role,
        "department": payload.department,
        "skills": payload.skills,
        "coverage": {"zone_ids": payload.zone_ids},
        "schedule": {
            "timezone": "Asia/Jerusalem",
            "shifts": [],
            "on_call": False,
        },
        "workload": {
            "active_tasks": 0,
            "max_tasks": payload.max_tasks,
        },
        "contacts": {
            "phone": payload.phone,
            "email": str(payload.email) if payload.email else None,
        },
        "active": payload.active,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }

    result = collections["staff_members"].insert_one(document)
    created = collections["staff_members"].find_one({"_id": result.inserted_id})
    return serialize_document(created)


@router.get("/staff")
def list_staff_members(
    role: Optional[StaffRole] = None,
    active: Optional[bool] = None,
    collections=Depends(get_collections),
    _access: None = Depends(require_staff_access),
):
    query = {}
    if role:
        query["role"] = role
    if active is not None:
        query["active"] = active

    records = list(collections["staff_members"].find(query).sort("created_at", -1))
    return [serialize_document(record) for record in records]


@router.get("/staff/{staff_id}")
def get_staff_member(
    staff_id: str,
    collections=Depends(get_collections),
    _access: None = Depends(require_staff_access),
):
    staff_member = fetch_staff_or_404(collections["staff_members"], staff_id)

    summary = {
        "active_survey_tasks": 0,
        "completed_survey_tasks": 0,
        "uploaded_reports": 0,
    }

    if staff_member.get("role") == "surveyor":
        summary["active_survey_tasks"] = collections["survey_tasks"].count_documents(
            {
                "assigned_surveyor_id": staff_member["_id"],
                "status": {"$nin": list(FINAL_TASK_STATUSES)},
            }
        )
        summary["completed_survey_tasks"] = collections["survey_tasks"].count_documents(
            {
                "assigned_surveyor_id": staff_member["_id"],
                "status": "registrar_reviewed",
            }
        )
        summary["uploaded_reports"] = collections["survey_reports"].count_documents(
            {"uploaded_by_staff_id": staff_member["_id"]}
        )

    staff_member["performance_summary"] = summary
    return serialize_document(staff_member)


@router.get("/survey-tasks")
def list_survey_tasks(
    surveyor_id: Optional[str] = None,
    application_id: Optional[str] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    collections=Depends(get_collections),
    _access: None = Depends(require_staff_access),
):
    query = {}
    if surveyor_id:
        query["assigned_surveyor_id"] = to_object_id(surveyor_id)
    if application_id:
        query["application_id"] = to_object_id(application_id)
    if status_filter:
        query["status"] = status_filter

    records = list(collections["survey_tasks"].find(query).sort("created_at", -1))
    return [serialize_document(record) for record in records]


@router.post("/applications/{application_id}/auto-assign-surveyor")
def auto_assign_surveyor(
    application_id: str,
    payload: AutoAssignSurveyorRequest,
    collections=Depends(get_collections),
    _access: None = Depends(require_staff_access),
):
    application = fetch_application_or_404(collections["land_applications"], application_id)

    existing_task = collections["survey_tasks"].find_one(
        {
            "application_id": application["_id"],
            "status": {"$nin": list(FINAL_TASK_STATUSES)},
        }
    )
    if existing_task:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This application already has an active survey task",
        )

    zone_id = application.get("zone_id")
    if not zone_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Application has no zone_id")

    candidates = list(
        collections["staff_members"].find(
            {
                "role": "surveyor",
                "active": True,
                "coverage.zone_ids": zone_id,
            }
        )
    )

    available_surveyors = []
    for surveyor in candidates:
        workload = surveyor.get("workload", {})
        active_tasks = workload.get("active_tasks", 0)
        max_tasks = workload.get("max_tasks", 10)
        skills = surveyor.get("skills", [])

        if active_tasks >= max_tasks:
            continue
        if payload.required_skill and payload.required_skill not in skills:
            continue

        available_surveyors.append(surveyor)

    if not available_surveyors:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No available surveyor found for this zone, skill, and workload",
        )

    best_surveyor = sorted(
        available_surveyors,
        key=lambda item: (
            item.get("workload", {}).get("active_tasks", 0),
            item.get("staff_code", ""),
        ),
    )[0]

    now = utc_now()
    task_document = {
        "task_id": f"SURV-{now.year}-{str(ObjectId())[-6:].upper()}",
        "application_id": application["_id"],
        "parcel_number": application.get("parcel_number"),
        "zone_id": zone_id,
        "assigned_surveyor_id": best_surveyor["_id"],
        "status": "assigned",
        "priority": payload.priority,
        "milestones": [
            {
                "type": "assigned",
                "at": now,
                "by": "system",
                "meta": {
                    "reason": "zone + workload + skill match",
                    "zone_id": zone_id,
                    "required_skill": payload.required_skill,
                },
            }
        ],
        "field_notes": [],
        "report_uploaded": False,
        "created_at": now,
        "updated_at": now,
    }

    result = collections["survey_tasks"].insert_one(task_document)

    collections["staff_members"].update_one(
        {"_id": best_surveyor["_id"]},
        {
            "$inc": {"workload.active_tasks": 1},
            "$set": {"updated_at": utc_now()},
        },
    )

    collections["land_applications"].update_one(
        {"_id": application["_id"]},
        {
            "$set": {
                "status": "survey_required",
                "assignment.assigned_surveyor_id": best_surveyor["_id"],
                "assignment.assignment_policy": "zone+workload+skill",
                "updated_at": utc_now(),
            }
        },
    )

    add_performance_event(
        collections,
        application["_id"],
        "survey_assigned",
        "system",
        "assignment_engine",
        {
            "assigned_surveyor_id": str(best_surveyor["_id"]),
            "assigned_surveyor_code": best_surveyor.get("staff_code"),
            "task_id": task_document["task_id"],
        },
    )

    created_task = collections["survey_tasks"].find_one({"_id": result.inserted_id})
    refreshed_surveyor = collections["staff_members"].find_one({"_id": best_surveyor["_id"]})

    return {
        "message": "Surveyor assigned successfully",
        "assigned_surveyor": serialize_document(refreshed_surveyor),
        "survey_task": serialize_document(created_task),
    }


@router.patch("/applications/{application_id}/survey-milestone")
def update_survey_milestone(
    application_id: str,
    payload: SurveyMilestoneUpdate,
    collections=Depends(get_collections),
    _access: None = Depends(require_staff_access),
):
    application = fetch_application_or_404(collections["land_applications"], application_id)
    task = fetch_active_task_for_application_or_404(collections, application["_id"])
    staff_member = fetch_staff_or_404(collections["staff_members"], payload.by_staff_id, required_role="surveyor")

    if task.get("assigned_surveyor_id") != staff_member["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned surveyor can update this survey task",
        )

    current_status = task.get("status", "assigned")
    if current_status not in SURVEY_MILESTONE_ORDER:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown current survey status")

    current_index = SURVEY_MILESTONE_ORDER.index(current_status)
    requested_index = SURVEY_MILESTONE_ORDER.index(payload.milestone)
    if requested_index != current_index + 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transition from {current_status} to {payload.milestone}",
        )

    milestone = {
        "type": payload.milestone,
        "at": utc_now(),
        "by": str(staff_member["_id"]),
        "meta": {
            "surveyor_code": staff_member.get("staff_code"),
            "scheduled_visit_date": payload.scheduled_visit_date,
            "notes": payload.notes,
        },
    }

    update_statement = {
        "$set": {
            "status": payload.milestone,
            "updated_at": utc_now(),
        },
        "$push": {"milestones": milestone},
    }

    if payload.notes:
        update_statement["$push"]["field_notes"] = {
            "at": utc_now(),
            "by": str(staff_member["_id"]),
            "notes": payload.notes,
        }

    collections["survey_tasks"].update_one({"_id": task["_id"]}, update_statement)

    if payload.milestone == "survey_completed":
        collections["land_applications"].update_one(
            {"_id": application["_id"]},
            {"$set": {"status": "surveyed", "updated_at": utc_now()}},
        )

    add_performance_event(
        collections,
        application["_id"],
        payload.milestone,
        "surveyor",
        str(staff_member["_id"]),
        {"surveyor_code": staff_member.get("staff_code"), "notes": payload.notes},
    )

    updated_task = collections["survey_tasks"].find_one({"_id": task["_id"]})
    return serialize_document(updated_task)


@router.post("/applications/{application_id}/survey-report", status_code=status.HTTP_201_CREATED)
def create_survey_report(
    application_id: str,
    payload: SurveyReportCreate,
    collections=Depends(get_collections),
    _access: None = Depends(require_staff_access),
):
    application = fetch_application_or_404(collections["land_applications"], application_id)
    task = fetch_active_task_for_application_or_404(collections, application["_id"])
    staff_member = fetch_staff_or_404(collections["staff_members"], payload.uploaded_by_staff_id, required_role="surveyor")

    if task.get("assigned_surveyor_id") != staff_member["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned surveyor can upload this report",
        )

    if task.get("status") != "survey_completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Survey must be completed before uploading the report",
        )

    report_document = {
        "application_id": application["_id"],
        "survey_task_id": task["_id"],
        "uploaded_by_staff_id": staff_member["_id"],
        "assigned_surveyor_id": task["assigned_surveyor_id"],
        "report_title": payload.report_title,
        "file_name": payload.file_name,
        "file_url": payload.file_url,
        "summary": payload.summary,
        "findings": payload.findings,
        "status": "uploaded",
        "uploaded_at": utc_now(),
        "review": None,
    }

    result = collections["survey_reports"].insert_one(report_document)

    milestone = {
        "type": "report_uploaded",
        "at": utc_now(),
        "by": str(staff_member["_id"]),
        "meta": {
            "surveyor_code": staff_member.get("staff_code"),
            "report_title": payload.report_title,
        },
    }

    collections["survey_tasks"].update_one(
        {"_id": task["_id"]},
        {
            "$set": {
                "status": "report_uploaded",
                "report_uploaded": True,
                "updated_at": utc_now(),
            },
            "$push": {"milestones": milestone},
        },
    )

    add_performance_event(
        collections,
        application["_id"],
        "survey_report_uploaded",
        "surveyor",
        str(staff_member["_id"]),
        {"report_title": payload.report_title, "file_name": payload.file_name},
    )

    created_report = collections["survey_reports"].find_one({"_id": result.inserted_id})
    return serialize_document(created_report)


@router.patch("/applications/{application_id}/registrar-review")
def registrar_review(
    application_id: str,
    payload: RegistrarReviewCreate,
    collections=Depends(get_collections),
    _access: None = Depends(require_staff_access),
):
    application = fetch_application_or_404(collections["land_applications"], application_id)
    task = fetch_active_task_for_application_or_404(collections, application["_id"])
    registrar = fetch_staff_or_404(collections["staff_members"], payload.registrar_staff_id, required_role="registrar")

    if task.get("status") != "report_uploaded":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A survey report must be uploaded before registrar review",
        )

    review = {
        "decision": payload.decision,
        "registrar_staff_id": registrar["_id"],
        "registrar_code": registrar.get("staff_code"),
        "notes": payload.notes,
        "reviewed_at": utc_now(),
    }

    collections["survey_tasks"].update_one(
        {"_id": task["_id"]},
        {
            "$set": {
                "status": "registrar_reviewed",
                "registrar_review": review,
                "updated_at": utc_now(),
            },
            "$push": {
                "milestones": {
                    "type": "registrar_reviewed",
                    "at": utc_now(),
                    "by": str(registrar["_id"]),
                    "meta": {
                        "decision": payload.decision,
                        "notes": payload.notes,
                        "registrar_code": registrar.get("staff_code"),
                    },
                }
            },
        },
    )

    collections["survey_reports"].update_many(
        {"survey_task_id": task["_id"], "status": "uploaded"},
        {
            "$set": {
                "status": "reviewed",
                "review": review,
                "updated_at": utc_now(),
            }
        },
    )

    new_application_status = "legal_review" if payload.decision == "accepted" else "on_hold"
    collections["land_applications"].update_one(
        {"_id": application["_id"]},
        {
            "$set": {
                "status": new_application_status,
                "updated_at": utc_now(),
            },
            "$push": {
                "internal_notes": {
                    "at": utc_now(),
                    "by": str(registrar["_id"]),
                    "note": f"Survey registrar review: {payload.decision}. {payload.notes or ''}",
                }
            },
        },
    )

    assigned_surveyor_id = task.get("assigned_surveyor_id")
    assigned_surveyor = collections["staff_members"].find_one({"_id": assigned_surveyor_id})
    active_tasks = assigned_surveyor.get("workload", {}).get("active_tasks", 0) if assigned_surveyor else 0
    if assigned_surveyor and active_tasks > 0:
        collections["staff_members"].update_one(
            {"_id": assigned_surveyor_id},
            {
                "$set": {
                    "workload.active_tasks": active_tasks - 1,
                    "updated_at": utc_now(),
                }
            },
        )

    add_performance_event(
        collections,
        application["_id"],
        "registrar_reviewed",
        "registrar",
        str(registrar["_id"]),
        {"decision": payload.decision, "notes": payload.notes},
    )

    updated_task = collections["survey_tasks"].find_one({"_id": task["_id"]})
    return serialize_document(updated_task)
