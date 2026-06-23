# LRMIS - Land Registration Management Information System

Simple GitHub-ready starter for the COMP4382 final project.


## Tech Stack

- Backend: FastAPI
- Database: Local MongoDB with PyMongo
- Frontend: React + TypeScript + Vite
- Repository style: single GitHub repository

## How to Run

### 1. Start MongoDB

Make sure MongoDB is running locally on port `27017`.

If you use Docker, you can start MongoDB with:

```bash
docker run --name lrmis-mongo -p 27017:27017 -d mongo:latest
```

The backend uses these default environment values:

```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=lrm_is_db
```

You can also copy `.env.example` and adjust it if needed.

### 2. Run the Backend

From the project root:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend will run at:

- http://localhost:8000
- http://localhost:8000/docs

### 3. Run the Frontend

Open a second terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

The frontend will run at:

- http://localhost:5173

The frontend expects the API at `http://localhost:8000` by default. You can change it with `VITE_API_URL`.


## Database Collections

The backend stores data in these MongoDB collections:

- applicants
- land_applications
- application_documents
- objections
- application_comments

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
