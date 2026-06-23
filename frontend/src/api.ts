import type {
  Applicant,
  Application,
  ApplicationType,
  ApplicantType,
  CommentRecord,
  DocumentRecord,
  ObjectionRecord,
  TimelineEvent,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
