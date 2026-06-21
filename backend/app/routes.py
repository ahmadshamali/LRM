from fastapi import APIRouter, Depends, HTTPException, status

from .db import get_db
from .schemas import ApplicantCreate, ApplicationCreate, CommentCreate, DocumentCreate, ObjectionCreate
from .utils import serialize_document, to_object_id, utc_now


router = APIRouter()


def get_collections():
    db = get_db()
    return {
        "applicants": db["applicants"],
        "land_applications": db["land_applications"],
        "application_documents": db["application_documents"],
        "objections": db["objections"],
        "application_comments": db["application_comments"],
    }


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

    document = payload.model_dump()
    document["applicant_id"] = to_object_id(payload.applicant_id)
    document["status"] = "submitted"
    document["created_at"] = utc_now()

    # TODO: Student 1 will implement workflow/state transitions.
    result = collections["land_applications"].insert_one(document)
    created = collections["land_applications"].find_one({"_id": result.inserted_id})
    return serialize_document(created)


@router.get("/applicants/{applicant_id}/applications")
def list_applications(applicant_id: str, collections=Depends(get_collections)):
    fetch_applicant_or_404(collections["applicants"], applicant_id)
    records = list(collections["land_applications"].find({"applicant_id": to_object_id(applicant_id)}).sort("created_at", -1))
    return [serialize_document(record) for record in records]


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
    return serialize_document(created)


@router.post("/applications/{application_id}/objections", status_code=status.HTTP_201_CREATED)
def add_objection(application_id: str, payload: ObjectionCreate, collections=Depends(get_collections)):
    fetch_application_or_404(collections["land_applications"], application_id)
    fetch_applicant_or_404(collections["applicants"], payload.applicant_id)

    document = payload.model_dump()
    document["application_id"] = to_object_id(application_id)
    document["applicant_id"] = to_object_id(payload.applicant_id)
    document["status"] = "pending"
    document["created_at"] = utc_now()

    result = collections["objections"].insert_one(document)
    created = collections["objections"].find_one({"_id": result.inserted_id})
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
