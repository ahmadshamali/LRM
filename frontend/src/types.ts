export type ApplicantType = 'citizen' | 'lawyer' | 'company' | 'surveyor' | 'authorized_representative';
export type ApplicationType =
  | 'first_registration'
  | 'ownership_transfer'
  | 'parcel_subdivision'
  | 'parcel_merge'
  | 'boundary_correction'
  | 'certificate_request';

export interface Applicant {
  id: string;
  full_name: string;
  applicant_type: ApplicantType;
  verification_state: 'unverified' | 'verified' | 'suspended';
  national_id?: string | null;
  registration_number?: string | null;
  email: string;
  phone: string;
  city: string;
  zone_id?: string | null;
  preferred_language: string;
  notification_method: 'email' | 'sms';
  created_at: string;
}

export interface Application {
  id: string;
  applicant_id: string;
  application_type: ApplicationType;
  parcel_number: string;
  block_number: string;
  basin_number: string;
  zone_id: string;
  description?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  assignment?: {
    assigned_surveyor_id?: string | null;
    assignment_policy?: string | null;
  };
}

export interface DocumentRecord {
  id: string;
  application_id: string;
  document_type: string;
  filename: string;
  uploaded_by_applicant_id: string;
  status: string;
  uploaded_at: string;
}

export interface CommentRecord {
  id: string;
  application_id: string;
  applicant_id: string;
  comment_text: string;
  created_at: string;
}

export interface ObjectionRecord {
  id: string;
  application_id: string;
  applicant_id: string;
  reason: string;
  supporting_document_filename?: string | null;
  status: string;
  created_at: string;
}

export interface TimelineEvent {
  event_type: string;
  title: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export type StaffRole = 'surveyor' | 'registrar';
export type SurveyMilestone = 'visit_scheduled' | 'arrived_on_site' | 'survey_started' | 'survey_completed';
export type RegistrarDecision = 'accepted' | 'rejected' | 'needs_revision';

export interface StaffMember {
  id: string;
  staff_code: string;
  name: string;
  role: StaffRole;
  department?: string | null;
  skills: string[];
  coverage: {
    zone_ids: string[];
  };
  schedule: {
    timezone: string;
    shifts: unknown[];
    on_call: boolean;
  };
  workload: {
    active_tasks: number;
    max_tasks: number;
  };
  contacts: {
    phone?: string | null;
    email?: string | null;
  };
  active: boolean;
  created_at: string;
  updated_at: string;
  performance_summary?: {
    active_survey_tasks: number;
    completed_survey_tasks: number;
    uploaded_reports: number;
  };
}

export interface SurveyTask {
  id: string;
  task_id: string;
  application_id: string;
  parcel_number?: string | null;
  zone_id: string;
  assigned_surveyor_id: string;
  status: string;
  priority: string;
  milestones: Array<{
    type: string;
    at: string;
    by: string;
    meta: Record<string, unknown>;
  }>;
  field_notes: Array<Record<string, unknown>>;
  report_uploaded: boolean;
  registrar_review?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyReport {
  id: string;
  application_id: string;
  survey_task_id: string;
  uploaded_by_staff_id: string;
  assigned_surveyor_id: string;
  report_title: string;
  file_name?: string | null;
  file_url?: string | null;
  summary?: string | null;
  findings?: string | null;
  status: string;
  uploaded_at: string;
  review?: Record<string, unknown> | null;
}

export interface AutoAssignResponse {
  message: string;
  assigned_surveyor: StaffMember;
  survey_task: SurveyTask;
}

export interface AnalyticsKpis {
  total_applications: number;
  pending_applications: number;
  approved_applications: number;
  rejected_applications: number;
  under_objection_applications: number;
  certificates_issued: number;
  average_processing_days: number | null;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface TypeCount {
  application_type: string;
  count: number;
}

export interface ZoneCount {
  zone_id: string;
  count: number;
}

export interface ProcessingTimeRecord {
  application_type: string;
  average_processing_days: number;
  count: number;
}

export interface SurveyorAnalytics {
  staff_id: string;
  staff_code?: string | null;
  name?: string | null;
  active_tasks: number;
  completed_tasks: number;
  total_tasks: number;
}

export interface RegistrarAnalytics {
  registrar_id: string;
  workload_count: number;
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: Record<string, unknown>;
  properties: Record<string, unknown>;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}
