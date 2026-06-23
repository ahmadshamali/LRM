# LRMIS - Land Registration Management Information System

Simple GitHub-ready starter for the COMP4382 final project.


## Tech Stack

- Backend: FastAPI
- Database: Local MongoDB with PyMongo
- Frontend: React + TypeScript + Vite
- Repository style: single GitHub repository


## MongoDB Setup

Use a local MongoDB instance.

Environment variables:

```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=lrm_is_db
```

The backend stores data in these collections:

- applicants
- land_applications
- application_documents
- objections
- application_comments

## Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

FastAPI docs are available at:

- http://localhost:8000/docs

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the API at `http://localhost:8000` by default. You can change it with `VITE_API_URL`.

## API Endpoints

- `POST /applicants`
- `GET /applicants/{applicant_id}`
- `POST /applications`
- `GET /applicants/{applicant_id}/applications`
- `GET /applications`
- `GET /applications/{application_id}`
- `POST /applications/{application_id}/documents`
- `POST /applications/{application_id}/comments`
- `POST /applications/{application_id}/objections`
- `GET /applications/{application_id}/timeline`
- Document upload is metadata-only for this starter.
