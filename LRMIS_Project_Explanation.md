# LRMIS_Codex_Guide.md

# Land Registration Management Information System (LRMIS)

## Project Overview

LRMIS (Land Registration Management Information System) is a workflow-driven, geospatial land registration platform built for a Land Authority or Municipality.

The system manages:

* Land registration applications
* Property ownership records
* Parcel information
* Survey operations
* Registrar reviews
* Objections and disputes
* Certificate issuance
* Geospatial visualization
* Analytics and reporting

The project must NOT be implemented as a simple CRUD application.

The system must enforce business workflows, validation rules, assignment logic, audit logs, geospatial data handling, dashboards, and reporting.

---

# Technology Stack

## Backend

* Python 3.12+
* FastAPI
* Pydantic v2
* PyMongo
* MongoDB

## Frontend

* React
* TypeScript
* Vite
* React Router
* React Query
* Leaflet
* OpenStreetMap

## Database

MongoDB

Use:

* Collections
* Aggregation Pipelines
* GeoJSON
* 2dsphere Indexes

---

# Architecture

Use clean architecture.

Structure:

backend/
├── app/
│ ├── api/
│ ├── services/
│ ├── repositories/
│ ├── models/
│ ├── schemas/
│ ├── core/
│ ├── utils/
│ └── database/

Rules:

* Business logic belongs in services
* API routes stay thin
* MongoDB access belongs in repositories
* Validation belongs in Pydantic schemas

---

# Main Modules

## Module 1: Land Application Management

Responsibilities:

* Create applications
* Manage workflow transitions
* Validate application requirements
* Store parcel references
* Store certificate information
* Store registrar notes
* Track document verification status

Application Types:

* first_registration
* ownership_transfer
* parcel_subdivision
* parcel_merge
* boundary_correction
* certificate_request

---

## Module 2: Applicant Portal

Applicant Types:

* citizen
* lawyer
* company
* surveyor
* representative

Verification States:

* unverified
* verified
* suspended

Features:

* Create profile
* Submit applications
* Upload documents
* Submit objections
* Track status
* View timeline
* Receive notifications

---

## Module 3: Surveyors and Registrar

Features:

* Staff management
* Survey assignment
* Milestone tracking
* Survey reports
* Registrar review

Assignment Policy:

Priority order:

1. Zone match
2. Availability
3. Workload
4. Skill match
5. Priority score

---

## Module 4: Analytics and Mapping

Features:

* KPI dashboard
* Application statistics
* Surveyor workload
* Registrar workload
* Live parcel map
* Heatmaps
* Reports

Use:

* MongoDB aggregation pipelines
* GeoJSON feeds
* Leaflet maps

---

# Workflow State Machine

Main workflow:

submitted
→ pre_checked
→ survey_required
→ surveyed
→ legal_review
→ approved
→ certificate_issued
→ closed

Alternative states:

* rejected
* on_hold
* missing_documents
* under_objection

---

# Workflow Rules

Validation rules must be enforced server-side.

Rule 1:

Cannot move to:

pre_checked

unless:

* applicant data complete
* parcel data complete

Rule 2:

Cannot move to:

survey_required

unless:

* parcel location valid

Rule 3:

Cannot move to:

surveyed

unless:

* survey report exists

Rule 4:

Cannot move to:

legal_review

unless:

* ownership documents uploaded

Rule 5:

Cannot move to:

approved

unless:

* legal review completed

Rule 6:

Cannot issue certificate unless:

* application approved

Rule 7:

Rejected applications must include:

* rejection reason

Rule 8:

Applications with objections move to:

under_objection

---

# Survey Milestones

assigned
→ visit_scheduled
→ arrived_on_site
→ survey_started
→ survey_completed
→ report_uploaded
→ registrar_reviewed

---

# MongoDB Collections

Required collections:

* applicants
* land_applications
* parcels
* application_documents
* objections
* staff_members
* survey_tasks
* survey_reports
* certificates
* performance_logs

---

# Audit Logging

Every important action must generate an audit event.

Examples:

* application submitted
* application approved
* survey assigned
* survey completed
* certificate issued
* objection submitted
* registrar review

Store events in:

performance_logs

---

# Geospatial Requirements

Parcel geometry stored as GeoJSON.

Example:

{
"type": "Polygon",
"coordinates": [...]
}

Requirements:

* 2dsphere index
* zone filtering
* parcel visualization
* heatmap generation
* spatial search

---

# Authentication

Implement JWT authentication.

Roles:

* applicant
* surveyor
* registrar
* admin

Protected endpoints must verify role permissions.

---

# API Standards

Rules:

* RESTful design
* JSON responses
* Pagination
* Filtering
* Sorting
* Validation errors
* Proper HTTP status codes

Examples:

200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
500 Internal Server Error

---

# Frontend Pages

Required Screens:

1. Login
2. Applicant Dashboard
3. Submit Application
4. Track Application
5. Upload Documents
6. Submit Objection
7. Staff Dashboard
8. Application Management Table
9. Application Details
10. Registrar Review
11. Certificate Issuance
12. Survey Tasks
13. Survey Task Execution
14. Live Parcel Map
15. Analytics Dashboard

---

# Dashboard KPIs

Display:

* Total Applications
* Pending Applications
* Approved Applications
* Rejected Applications
* Applications Under Objection
* Applications By Type
* Applications By Status
* Average Processing Time
* Surveyor Workload
* Registrar Workload
* Certificates Issued Per Month
* Hotspot Zones

---

# Coding Standards

Always:

* Use type hints
* Use Pydantic models
* Validate inputs
* Use repository pattern
* Separate business logic from routes
* Handle errors gracefully
* Write reusable code

Never:

* Put database logic in API routes
* Put business logic in React components
* Skip workflow validation
* Bypass authorization checks

---

# Goal

Build a production-style land registration system demonstrating:

* Workflow management
* Geospatial processing
* Survey assignment logic
* Registrar review process
* Audit logging
* Analytics dashboards
* Clean API architecture
* Professional frontend experience
