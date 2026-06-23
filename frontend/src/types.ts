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
