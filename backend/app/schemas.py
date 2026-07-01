from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


ApplicantType = Literal["citizen", "lawyer", "company", "surveyor", "authorized_representative"]
VerificationState = Literal["unverified", "verified", "suspended"]
NotificationMethod = Literal["email", "sms"]
ApplicationType = Literal[
    "first_registration",
    "ownership_transfer",
    "parcel_subdivision",
    "parcel_merge",
    "boundary_correction",
    "certificate_request",
]

StaffRole = Literal["surveyor", "registrar"]
SurveyMilestone = Literal[
    "visit_scheduled",
    "arrived_on_site",
    "survey_started",
    "survey_completed",
]
RegistrarDecision = Literal["accepted", "rejected", "needs_revision"]


class ApplicantCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(min_length=1)
    applicant_type: ApplicantType
    verification_state: VerificationState = "unverified"
    national_id: Optional[str] = None
    registration_number: Optional[str] = None
    email: EmailStr
    phone: str = Field(min_length=1)
    city: str = Field(min_length=1)
    zone_id: Optional[str] = None
    preferred_language: str = Field(default="en", min_length=1)
    notification_method: NotificationMethod = "email"

    @model_validator(mode="after")
    def validate_identity(self) -> "ApplicantCreate":
        if not self.national_id and not self.registration_number:
            raise ValueError("Either national_id or registration_number must be provided")
        return self


class AccountRegister(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(min_length=1)
    applicant_type: ApplicantType
    national_id: Optional[str] = None
    registration_number: Optional[str] = None
    email: EmailStr
    phone: str = Field(min_length=1)
    city: str = Field(min_length=1)
    zone_id: Optional[str] = None
    preferred_language: str = Field(default="en", min_length=1)
    notification_method: NotificationMethod = "email"
    password: str = Field(min_length=8)

    @model_validator(mode="after")
    def validate_identity(self) -> "AccountRegister":
        if not self.national_id and not self.registration_number:
            raise ValueError("Either national_id or registration_number must be provided")
        return self


class AccountLogin(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=1)


class ApplicationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    applicant_id: str = Field(min_length=1)
    application_type: ApplicationType
    parcel_number: str = Field(min_length=1)
    block_number: str = Field(min_length=1)
    basin_number: str = Field(min_length=1)
    zone_id: str = Field(min_length=1)
    description: Optional[str] = None


class DocumentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    document_type: str = Field(min_length=1)
    filename: str = Field(min_length=1)
    uploaded_by_applicant_id: str = Field(min_length=1)


class CommentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    applicant_id: str = Field(min_length=1)
    comment_text: str = Field(min_length=1)


class ObjectionCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    applicant_id: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    supporting_document_filename: Optional[str] = None


class TimelineEvent(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event_type: str
    title: str
    timestamp: str
    details: dict


# -----------------------------
# Student 3: Surveyors, Registrar, and Assignment
# -----------------------------


class StaffCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    staff_code: str = Field(min_length=1)
    name: str = Field(min_length=1)
    role: StaffRole
    department: Optional[str] = None
    skills: list[str] = Field(default_factory=list)
    zone_ids: list[str] = Field(default_factory=list)
    max_tasks: int = Field(default=10, ge=1, le=100)
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    active: bool = True


class AutoAssignSurveyorRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    required_skill: Optional[str] = "boundary_survey"
    priority: Literal["low", "normal", "high", "urgent"] = "normal"


class SurveyMilestoneUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    milestone: SurveyMilestone
    by_staff_id: str = Field(min_length=1)
    scheduled_visit_date: Optional[str] = None
    notes: Optional[str] = None


class SurveyReportCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    report_title: str = Field(min_length=1)
    uploaded_by_staff_id: str = Field(min_length=1)
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    summary: Optional[str] = None
    findings: Optional[str] = None


class RegistrarReviewCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    registrar_staff_id: str = Field(min_length=1)
    decision: RegistrarDecision
    notes: Optional[str] = None
