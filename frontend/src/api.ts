import type {
  Applicant,
  Application,
  ApplicationType,
  ApplicantType,
  AuthSession,
  AutoAssignResponse,
  CommentRecord,
  DocumentRecord,
  AnalyticsKpis,
  ObjectionRecord,
  GeoJsonFeatureCollection,
  ProcessingTimeRecord,
  RegistrarDecision,
  RegistrarAnalytics,
  StaffMember,
  StaffRole,
  StatusCount,
  SurveyorAnalytics,
  SurveyMilestone,
  SurveyReport,
  SurveyTask,
  TimelineEvent,
  TypeCount,
  ZoneCount,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const STAFF_TOKEN = import.meta.env.VITE_STAFF_TOKEN ?? 'staff-secret';
const AUTH_TOKEN_KEY = 'lrmis_auth_token';

export function getStoredAuthToken(): string {
  return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
}

export function setStoredAuthToken(token: string) {
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : Array.isArray(data?.detail)
          ? data.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(', ')
          : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

function storeSession(session: AuthSession): AuthSession {
  const token = session.token || getStoredAuthToken();
  setStoredAuthToken(token);
  return { ...session, token };
}

function staffHeaders(): HeadersInit {
  return { 'x-staff-token': STAFF_TOKEN };
}

export function registerAccount(payload: {
  full_name: string;
  applicant_type: ApplicantType;
  national_id?: string;
  registration_number?: string;
  email: string;
  phone: string;
  city: string;
  zone_id?: string;
  preferred_language?: string;
  notification_method?: 'email' | 'sms';
  password: string;
}): Promise<AuthSession> {
  return request<AuthSession>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then(storeSession);
}

export function loginAccount(payload: { email: string; password: string }): Promise<AuthSession> {
  return request<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then(storeSession);
}

export function getCurrentAccount(): Promise<AuthSession> {
  return request<AuthSession>('/auth/me').then(storeSession);
}

export async function logoutAccount(): Promise<void> {
  try {
    await request<{ message: string }>('/auth/logout', { method: 'POST' });
  } finally {
    setStoredAuthToken('');
  }
}

export function createApplicant(payload: {
  full_name: string;
  applicant_type: ApplicantType;
  national_id?: string;
  registration_number?: string;
  email: string;
  phone: string;
  city: string;
  zone_id?: string;
  preferred_language?: string;
  notification_method?: 'email' | 'sms';
}): Promise<Applicant> {
  return request<Applicant>('/applicants', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getApplicant(applicantId: string): Promise<Applicant> {
  return request<Applicant>(`/applicants/${applicantId}`);
}

export function createApplication(payload: {
  applicant_id: string;
  application_type: ApplicationType;
  parcel_number: string;
  block_number: string;
  basin_number: string;
  zone_id: string;
  description?: string;
}): Promise<Application> {
  return request<Application>('/applications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listApplications(applicantId: string): Promise<Application[]> {
  return request<Application[]>(`/applicants/${applicantId}/applications`);
}

export function listSharedApplications(filters: {
  applicant_id?: string;
  status?: string;
  application_type?: ApplicationType;
  zone_id?: string;
  skip?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'status' | 'application_type' | 'zone_id';
  sort_order?: 'asc' | 'desc';
} = {}): Promise<Application[]> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return request<Application[]>(`/applications${query ? `?${query}` : ''}`);
}

export function getApplication(applicationId: string): Promise<Application> {
  return request<Application>(`/applications/${applicationId}`);
}

export function addDocument(applicationId: string, payload: {
  document_type: string;
  filename: string;
  uploaded_by_applicant_id: string;
}): Promise<DocumentRecord> {
  return request<DocumentRecord>(`/applications/${applicationId}/documents`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function addComment(applicationId: string, payload: {
  applicant_id: string;
  comment_text: string;
}): Promise<CommentRecord> {
  return request<CommentRecord>(`/applications/${applicationId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function addObjection(applicationId: string, payload: {
  applicant_id: string;
  reason: string;
  supporting_document_filename?: string;
}): Promise<ObjectionRecord> {
  return request<ObjectionRecord>(`/applications/${applicationId}/objections`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getTimeline(applicationId: string): Promise<TimelineEvent[]> {
  return request<TimelineEvent[]>(`/applications/${applicationId}/timeline`);
}


//habeeb's work


export function createStaff(payload: {
  staff_code: string;
  name: string;
  role: StaffRole;
  department?: string;
  skills: string[];
  zone_ids: string[];
  max_tasks: number;
  phone?: string;
  email?: string;
  active?: boolean;
}): Promise<StaffMember> {
  return request<StaffMember>('/staff', {
    method: 'POST',
    headers: staffHeaders(),
    body: JSON.stringify(payload),
  });
}

export function listStaff(filters: { role?: StaffRole; active?: boolean } = {}): Promise<StaffMember[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return request<StaffMember[]>(`/staff${query ? `?${query}` : ''}`, {
    headers: staffHeaders(),
  });
}

export function getStaff(staffId: string): Promise<StaffMember> {
  return request<StaffMember>(`/staff/${staffId}`, {
    headers: staffHeaders(),
  });
}

export function listSurveyTasks(filters: {
  surveyor_id?: string;
  application_id?: string;
  status?: string;
} = {}): Promise<SurveyTask[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return request<SurveyTask[]>(`/survey-tasks${query ? `?${query}` : ''}`, {
    headers: staffHeaders(),
  });
}

export function autoAssignSurveyor(applicationId: string, payload: {
  required_skill?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}): Promise<AutoAssignResponse> {
  return request<AutoAssignResponse>(`/applications/${applicationId}/auto-assign-surveyor`, {
    method: 'POST',
    headers: staffHeaders(),
    body: JSON.stringify(payload),
  });
}

export function updateSurveyMilestone(applicationId: string, payload: {
  milestone: SurveyMilestone;
  by_staff_id: string;
  scheduled_visit_date?: string;
  notes?: string;
}): Promise<SurveyTask> {
  return request<SurveyTask>(`/applications/${applicationId}/survey-milestone`, {
    method: 'PATCH',
    headers: staffHeaders(),
    body: JSON.stringify(payload),
  });
}

export function uploadSurveyReport(applicationId: string, payload: {
  report_title: string;
  uploaded_by_staff_id: string;
  file_name?: string;
  file_url?: string;
  summary?: string;
  findings?: string;
}): Promise<SurveyReport> {
  return request<SurveyReport>(`/applications/${applicationId}/survey-report`, {
    method: 'POST',
    headers: staffHeaders(),
    body: JSON.stringify(payload),
  });
}

export function registrarReview(applicationId: string, payload: {
  registrar_staff_id: string;
  decision: RegistrarDecision;
  notes?: string;
}): Promise<SurveyTask> {
  return request<SurveyTask>(`/applications/${applicationId}/registrar-review`, {
    method: 'PATCH',
    headers: staffHeaders(),
    body: JSON.stringify(payload),
  });
}

export function getAnalyticsKpis(): Promise<AnalyticsKpis> {
  return request<AnalyticsKpis>('/analytics/kpis');
}

export function getApplicationsByStatus(): Promise<StatusCount[]> {
  return request<StatusCount[]>('/analytics/applications-by-status');
}

export function getApplicationsByType(): Promise<TypeCount[]> {
  return request<TypeCount[]>('/analytics/applications-by-type');
}

export function getApplicationsByZone(): Promise<ZoneCount[]> {
  return request<ZoneCount[]>('/analytics/applications-by-zone');
}

export function getProcessingTime(): Promise<ProcessingTimeRecord[]> {
  return request<ProcessingTimeRecord[]>('/analytics/processing-time');
}

export function getSurveyorAnalytics(): Promise<SurveyorAnalytics[]> {
  return request<SurveyorAnalytics[]>('/analytics/surveyors');
}

export function getRegistrarAnalytics(): Promise<RegistrarAnalytics[]> {
  return request<RegistrarAnalytics[]>('/analytics/registrars');
}

export function getParcelsGeoFeed(): Promise<GeoJsonFeatureCollection> {
  return request<GeoJsonFeatureCollection>('/analytics/geofeeds/parcels');
}

export function getPendingHeatmapGeoFeed(): Promise<GeoJsonFeatureCollection> {
  return request<GeoJsonFeatureCollection>('/analytics/geofeeds/pending-heatmap');
}

export function getApplicationsCsvUrl(): string {
  return `${API_BASE_URL}/analytics/export/applications.csv`;
}
