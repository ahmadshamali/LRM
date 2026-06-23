# LRMIS - Land Registration Management Information System

Simple GitHub-ready starter for the COMP4382 final project.


## Tech Stack

- Backend: FastAPI
- Database: Local MongoDB with PyMongo
- Frontend: React + TypeScript + Vite + Leaflet
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
- staff_members
- survey_tasks
- survey_reports
- certificates
- parcels
- performance_logs

## Frontend Pages

- `http://localhost:5173` opens the tab-based demo UI.
- Use the `Analytics and Map` tab for KPIs, grouped analytics, parcel GeoJSON, and pending application highlights.

The frontend uses `leaflet` and `@types/leaflet` for the OpenStreetMap parcel map.

## API Endpoints

### Applicant Endpoints

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

### Staff, Survey, and Registrar Endpoints

Staff endpoints require the `x-staff-token` header. The frontend uses `VITE_STAFF_TOKEN` or `staff-secret` by default.

- `POST /staff`
- `GET /staff`
- `GET /staff/{staff_id}`
- `GET /survey-tasks`
- `POST /applications/{application_id}/auto-assign-surveyor`
- `PATCH /applications/{application_id}/survey-milestone`
- `POST /applications/{application_id}/survey-report`
- `PATCH /applications/{application_id}/registrar-review`

### Analytics and Map Endpoints

- `GET /analytics/kpis`
- `GET /analytics/applications-by-status`
- `GET /analytics/applications-by-type`
- `GET /analytics/applications-by-zone`
- `GET /analytics/processing-time`
- `GET /analytics/surveyors`
- `GET /analytics/registrars`
- `GET /analytics/geofeeds/parcels`
- `GET /analytics/geofeeds/pending-heatmap`
- `GET /analytics/export/applications.csv`

The analytics router attempts to ensure these indexes without failing if they already exist:

- `land_applications.status`
- `land_applications.workflow.current_state`
- `land_applications.application_type`
- `land_applications.parcel_ref.zone_id`
- `parcels.geometry` as a `2dsphere` index when parcel geometry is valid
