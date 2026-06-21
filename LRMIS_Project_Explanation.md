# LRMIS - Land Registration Management Information System

## 1. Project Overview

The **Land Registration Management Information System (LRMIS)** is a course project for managing land registration services digitally.

The system supports applicants, land applications, surveyors, registrars, certificates, maps, and analytics. It is not only a simple CRUD system. The important part is that land applications must move through a controlled workflow with validation rules, documents, survey tasks, registrar review, objections, and certificate issuance.

The main goal is to improve land registration transparency, accuracy, and tracking by replacing manual paper-based steps with a structured digital workflow.

---

## 2. Main System Workflow

A normal application should follow this flow:

```text
submitted
↓
pre_checked
↓
survey_required
↓
surveyed
↓
legal_review
↓
approved
↓
certificate_issued
↓
closed
```

There are also alternative states:

```text
rejected
on_hold
missing_documents
under_objection
```

Example workflow:

1. Applicant submits a land registration application.
2. Staff checks applicant, parcel, and document information.
3. If a field survey is required, the application moves to survey-required state.
4. A surveyor is assigned based on zone, availability, skill, and workload.
5. Surveyor completes field milestones and uploads survey report metadata.
6. Registrar reviews documents, parcel details, survey report, and objections.
7. Registrar approves or rejects the application.
8. If approved, certificate metadata is generated.
9. Application is closed after certificate issuance.

---

## 3. Technology Stack

### Backend

- FastAPI
- Python
- PyMongo
- Pydantic
- Uvicorn
- python-dotenv

### Database

- MongoDB
- Local MongoDB using Docker is recommended for easier setup.

### Frontend

- React
- TypeScript
- Vite
- Plain CSS or any simple UI approach

### Map and Visualization

- OpenStreetMap
- Leaflet
- GeoJSON

### Documentation

- Swagger/OpenAPI
- README.md
- Postman collection if needed

---

## 4. Main MongoDB Collections

The system can use these collections:

```text
applicants
land_applications
parcels
application_documents
application_comments
objections
staff_members
survey_tasks
survey_reports
certificates
performance_logs
```

Each module may use only the collections it needs, but shared field names must stay consistent.

Important shared fields:

```text
applicant_id
application_id
status
application_type
parcel_number
block_number
basin_number
zone_id
created_at
updated_at
```

---

# 5. Project Modules

The project is divided into **four modules**.

There are **three students**, so each student takes one main module, and the fourth module is shared by the group.

---

## Module 1: Land Application Management

### Responsible Student

Student 1

### Purpose

This is the core backend workflow module. It manages land registration applications and controls how an application moves from one state to another.

### What This Module Does

This module allows the system to:

- Create land registration applications.
- Retrieve application details.
- List applications with filtering, pagination, and sorting.
- Store parcel information.
- Store parcel location using GeoJSON.
- Store attached documents and their verification states.
- Store registrar notes and internal remarks.
- Move applications through the official workflow.
- Reject applications with a mandatory reason.
- Put applications on hold with a reason.
- Generate certificate metadata after approval.
- Record important actions in performance logs.

### Main Workflow Responsibilities

Student 1 must enforce rules such as:

- An application cannot move to `pre_checked` unless applicant and parcel information are complete.
- An application cannot move to `survey_required` unless parcel location is valid.
- An application cannot move to `surveyed` unless a survey report exists.
- An application cannot move to `legal_review` unless ownership documents are uploaded.
- An application cannot move to `approved` unless legal review is completed.
- A certificate cannot be issued unless the application is approved.
- A rejected application must include a rejection reason.
- Applications with objections should move to `under_objection`.

### Suggested APIs

```http
POST /applications
GET /applications
GET /applications/{application_id}
PATCH /applications/{application_id}/transition
POST /applications/{application_id}/hold
POST /applications/{application_id}/reject
POST /applications/{application_id}/certificate
```

### Difficulty

This is one of the hardest modules because it contains:

- Workflow/state-machine logic.
- Validation rules.
- Certificate state.
- Application status transitions.
- Shared data used by all other modules.

---

## Module 2: Applicant Portal and Profiles

### Responsible Student

Student 2

### Purpose

This module is the applicant-facing part of the system. It allows citizens, lawyers, companies, surveyors, and representatives to create profiles, submit applications, upload documents, track status, add comments, and submit objections.

### What This Module Does

This module allows applicants to:

- Create applicant profiles.
- Submit simple land registration applications.
- View their submitted applications.
- Track application status.
- Upload required document metadata.
- Add comments or responses.
- Submit objections.
- View application timeline/history.
- Receive notification stubs through email/SMS fields.

### Applicant Profile Fields

An applicant profile should include:

```text
full_name
applicant_type
verification_state
national_id
registration_number
email
phone
city
zone_id
preferred_language
notification_method
created_at
```

Applicant types:

```text
citizen
lawyer
company
surveyor
authorized_representative
```

Verification states:

```text
unverified
verified
suspended
```

### Application Submission Fields

When the applicant submits an application, the system should store:

```text
applicant_id
application_type
parcel_number
block_number
basin_number
zone_id
description
status
created_at
```

Application types:

```text
first_registration
ownership_transfer
parcel_subdivision
parcel_merge
boundary_correction
certificate_request
```

Default application status:

```text
submitted
```

### Suggested APIs

```http
POST /applicants
GET /applicants/{applicant_id}
POST /applications
GET /applicants/{applicant_id}/applications
GET /applications/{application_id}
POST /applications/{application_id}/documents
POST /applications/{application_id}/comments
POST /applications/{application_id}/objections
GET /applications/{application_id}/timeline
```

### Important Note

This module may create the initial application record, but it should not implement the full workflow logic. Full workflow transitions belong to Module 1.

For example:

```text
Applicant Portal creates application with status = submitted.
Student 1 later manages transitions such as submitted → pre_checked.
```

### Difficulty

This is the easiest module because most of it is forms, profile CRUD, document metadata, comments, objections, and status viewing. It has less complex business logic than Module 1 and no assignment algorithm like Module 3.

---

## Module 3: Surveyors, Registrar, and Assignment

### Responsible Student

Student 3

### Purpose

This module manages staff, surveyors, registrar decisions, survey task assignment, and survey progress.

### What This Module Does

This module allows the system to:

- Create and manage surveyor accounts.
- Create and manage registrar/staff accounts.
- Define surveyor coverage zones.
- Define surveyor skills and specialization.
- Define surveyor availability and schedule.
- Automatically assign surveyors to survey-required applications.
- Manually reassign surveyors if needed.
- Track field survey milestones.
- Upload survey report metadata.
- Allow registrar staff to review survey results.
- Add internal decision notes.
- Implement basic staff-only access control.

### Assignment Policy

The automatic assignment should consider:

```text
zone match
surveyor availability
workload balancing
skill match
application priority
existing assigned tasks
```

Simple version:

```text
Find surveyors in the same zone.
Filter available surveyors.
Filter surveyors with matching skills.
Choose the surveyor with the lowest active workload.
Assign the task.
```

### Survey Milestones

Survey tasks should follow this flow:

```text
assigned
↓
visit_scheduled
↓
arrived_on_site
↓
survey_started
↓
survey_completed
↓
report_uploaded
↓
registrar_reviewed
```

### Suggested APIs

```http
POST /staff
GET /staff/{staff_id}
POST /applications/{application_id}/auto-assign-surveyor
PATCH /applications/{application_id}/survey-milestone
POST /applications/{application_id}/survey-report
PATCH /applications/{application_id}/registrar-review
```

### Difficulty

This module is medium difficulty. It is not as hard as Module 1, but it has assignment logic and staff-only actions.

The hardest part is the automatic surveyor assignment algorithm.

---

## Module 4: Data Analysis, Map, and Visualization

### Responsible Students

Group Module

### Purpose

This module provides dashboards, analytics, spatial visualization, maps, reports, and management insights.

### What This Module Does

The group module should show:

- Total applications.
- Applications by status.
- Applications by type.
- Pending applications.
- Approved applications.
- Rejected applications.
- Applications under objection.
- Average processing time.
- Surveyor workload.
- Registrar workload.
- Certificates issued per month.
- Hotspot zones with high number of applications.
- Delayed applications.

### Map Features

The map should display:

- Land parcels.
- Pending applications.
- Disputed parcels.
- Survey-required applications.
- Survey task locations.
- Parcel boundaries using GeoJSON.

Recommended map tools:

```text
OpenStreetMap
Leaflet
GeoJSON
```

### Analytics APIs

```http
GET /analytics/kpis
GET /analytics/applications-by-status
GET /analytics/applications-by-zone
GET /analytics/processing-time
GET /analytics/surveyors
GET /analytics/registrars
GET /analytics/geofeeds/parcels
GET /analytics/geofeeds/pending-heatmap
```

### MongoDB Operators

This module should use MongoDB aggregation and geospatial tools such as:

```text
$match
$group
$sort
$project
$lookup
$facet
$bucketAuto
$geoNear
$unwind
```

### Difficulty

This module is shared because it depends on data from all other modules.

It reads from:

```text
land_applications
applicants
survey_tasks
staff_members
certificates
parcels
objections
performance_logs
```

The frontend dashboard and map can be simple, but they must clearly show useful statistics and spatial information.

---

# 6. Dependency Between Modules

The modules are connected through shared data.

## Module Dependency Flow

```text
Applicant Profile
    ↓
Land Application
    ↓
Workflow Validation
    ↓
Survey Assignment
    ↓
Registrar Review
    ↓
Certificate Issuance
    ↓
Analytics and Map
```

## Important Dependencies

### Module 2 depends on Module 1

Applicant Portal creates and tracks applications, but Module 1 controls the full application workflow.

### Module 1 depends on Module 2

Every application needs an applicant reference.

### Module 3 depends on Module 1

Survey tasks only exist when an application requires a survey.

### Module 4 depends on all modules

Analytics and maps read data from applications, applicants, survey tasks, certificates, parcels, and objections.

---

# 7. What Each Student Should Agree On

Before implementing separately, all students should agree on shared contracts.

## Shared Field Names

```text
applicant_id
application_id
status
application_type
parcel_number
block_number
basin_number
zone_id
created_at
updated_at
```

## Shared Collection Names

```text
applicants
land_applications
application_documents
application_comments
objections
staff_members
survey_tasks
survey_reports
certificates
performance_logs
parcels
```

## Shared Status Names

```text
submitted
pre_checked
survey_required
surveyed
legal_review
approved
certificate_issued
closed
rejected
on_hold
missing_documents
under_objection
```

## Shared Application Types

```text
first_registration
ownership_transfer
parcel_subdivision
parcel_merge
boundary_correction
certificate_request
```

---

# 8. Recommended Simple Team Split

## Student 1

Focus on:

```text
land_applications
workflow transitions
certificate metadata
application validation
registrar notes
```

## Student 2

Focus on:

```text
applicants
application submission
document metadata
comments
objections
timeline display
applicant dashboard
```

## Student 3

Focus on:

```text
staff_members
survey_tasks
survey assignment
survey milestones
survey reports
registrar review
```

## Group

Focus on:

```text
analytics
dashboard
map
GeoJSON feeds
reports
```

---

# 9. Minimum Working Demo

A good final demo should show this sequence:

1. Create applicant profile.
2. Submit land registration application.
3. Upload document metadata.
4. Staff pre-checks application.
5. Application moves to survey-required.
6. Surveyor is assigned.
7. Surveyor updates survey milestones.
8. Registrar reviews and approves.
9. Certificate metadata is generated.
10. Dashboard and map show updated data.

---

# 10. Important Notes

- This is a course project, not a production system.
- Keep implementation simple and explainable.
- Do not waste time on real SMS, real email, payment, or advanced authentication.
- The system must demonstrate workflow, validation, MongoDB usage, GeoJSON/map usage, APIs, and clear module separation.
- Each student must understand their own module and the shared group module.
