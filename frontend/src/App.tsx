import { FormEvent, useMemo, useState } from 'react';
import { addComment, addDocument, addObjection, createApplicant, createApplication, getApplication, getApplicant, getTimeline, listApplications } from './api';
import type { ApplicationType, ApplicantType } from './types';

type TabKey = 'create-applicant' | 'submit-application' | 'my-applications' | 'track-application' | 'upload-document' | 'add-comment' | 'submit-objection' | 'timeline';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'create-applicant', label: 'Create Applicant' },
  { key: 'submit-application', label: 'Submit Application' },
  { key: 'my-applications', label: 'My Applications' },
  { key: 'track-application', label: 'Track Application' },
  { key: 'upload-document', label: 'Upload Document Metadata' },
  { key: 'add-comment', label: 'Add Comment' },
  { key: 'submit-objection', label: 'Submit Objection' },
  { key: 'timeline', label: 'Timeline' },
];

const applicantTypes: ApplicantType[] = ['citizen', 'lawyer', 'company', 'surveyor', 'authorized_representative'];
const applicationTypes: ApplicationType[] = [
  'first_registration',
  'ownership_transfer',
  'parcel_subdivision',
  'parcel_merge',
  'boundary_correction',
  'certificate_request',
];

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (!value) {
    return null;
  }

  return (
    <section className="result-block">
      <h3>{title}</h3>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('create-applicant');

  const [applicantForm, setApplicantForm] = useState({
    full_name: '',
    applicant_type: 'citizen' as ApplicantType,
    national_id: '',
    registration_number: '',
    email: '',
    phone: '',
    city: '',
    zone_id: '',
    preferred_language: 'en',
    notification_method: 'email' as 'email' | 'sms',
  });
  const [applicantResult, setApplicantResult] = useState<unknown>(null);
  const [applicantStatus, setApplicantStatus] = useState('');
  const [applicantError, setApplicantError] = useState('');
  const [applicantLoading, setApplicantLoading] = useState(false);

  const [applicationForm, setApplicationForm] = useState({
    applicant_id: '',
    application_type: 'first_registration' as ApplicationType,
    parcel_number: '',
    block_number: '',
    basin_number: '',
    zone_id: '',
    description: '',
  });
  const [applicationResult, setApplicationResult] = useState<unknown>(null);
  const [applicationStatus, setApplicationStatus] = useState('');
  const [applicationError, setApplicationError] = useState('');
  const [applicationLoading, setApplicationLoading] = useState(false);

  const [lookupApplicantId, setLookupApplicantId] = useState('');
  const [lookupApplications, setLookupApplications] = useState<unknown>(null);
  const [lookupStatus, setLookupStatus] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  const [trackApplicationId, setTrackApplicationId] = useState('');
  const [trackApplicationResult, setTrackApplicationResult] = useState<unknown>(null);
  const [trackApplicationStatus, setTrackApplicationStatus] = useState('');
  const [trackApplicationError, setTrackApplicationError] = useState('');
  const [trackApplicationLoading, setTrackApplicationLoading] = useState(false);

  const [documentForm, setDocumentForm] = useState({
    application_id: '',
    document_type: '',
    filename: '',
    uploaded_by_applicant_id: '',
  });
  const [documentResult, setDocumentResult] = useState<unknown>(null);
  const [documentStatus, setDocumentStatus] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [documentLoading, setDocumentLoading] = useState(false);

  const [commentForm, setCommentForm] = useState({
    application_id: '',
    applicant_id: '',
    comment_text: '',
  });
  const [commentResult, setCommentResult] = useState<unknown>(null);
  const [commentStatus, setCommentStatus] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  const [objectionForm, setObjectionForm] = useState({
    application_id: '',
    applicant_id: '',
    reason: '',
    supporting_document_filename: '',
  });
  const [objectionResult, setObjectionResult] = useState<unknown>(null);
  const [objectionStatus, setObjectionStatus] = useState('');
  const [objectionError, setObjectionError] = useState('');
  const [objectionLoading, setObjectionLoading] = useState(false);

  const [timelineApplicationId, setTimelineApplicationId] = useState('');
  const [timelineResult, setTimelineResult] = useState<unknown>(null);
  const [timelineStatus, setTimelineStatus] = useState('');
  const [timelineError, setTimelineError] = useState('');
  const [timelineLoading, setTimelineLoading] = useState(false);

  const activeLabel = useMemo(() => tabs.find((tab) => tab.key === activeTab)?.label ?? '', [activeTab]);

  async function handleApplicantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplicantLoading(true);
    setApplicantError('');
    setApplicantStatus('Creating applicant...');

    try {
      const result = await createApplicant({
        full_name: applicantForm.full_name,
        applicant_type: applicantForm.applicant_type,
        national_id: applicantForm.national_id || undefined,
        registration_number: applicantForm.registration_number || undefined,
        email: applicantForm.email,
        phone: applicantForm.phone,
        city: applicantForm.city,
        zone_id: applicantForm.zone_id || undefined,
        preferred_language: applicantForm.preferred_language,
        notification_method: applicantForm.notification_method,
      });

      setApplicantResult(result);
      setApplicantStatus(`Applicant created: ${result.id}`);
    } catch (error) {
      setApplicantError(error instanceof Error ? error.message : 'Unable to create applicant');
      setApplicantStatus('');
    } finally {
      setApplicantLoading(false);
    }
  }

  async function handleApplicationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplicationLoading(true);
    setApplicationError('');
    setApplicationStatus('Submitting application...');

    try {
      const result = await createApplication({
        applicant_id: applicationForm.applicant_id,
        application_type: applicationForm.application_type,
        parcel_number: applicationForm.parcel_number,
        block_number: applicationForm.block_number,
        basin_number: applicationForm.basin_number,
        zone_id: applicationForm.zone_id,
        description: applicationForm.description || undefined,
      });

      setApplicationResult(result);
      setApplicationStatus(`Application submitted: ${result.id}`);
    } catch (error) {
      setApplicationError(error instanceof Error ? error.message : 'Unable to submit application');
      setApplicationStatus('');
    } finally {
      setApplicationLoading(false);
    }
  }

  async function handleApplicationsLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLookupLoading(true);
    setLookupError('');
    setLookupStatus('Loading applications...');

    try {
      await getApplicant(lookupApplicantId);
      const result = await listApplications(lookupApplicantId);
      setLookupApplications(result);
      setLookupStatus(`Loaded ${result.length} applications`);
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : 'Unable to load applications');
      setLookupStatus('');
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleTrackApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTrackApplicationLoading(true);
    setTrackApplicationError('');
    setTrackApplicationStatus('Loading application...');

    try {
      const result = await getApplication(trackApplicationId);
      setTrackApplicationResult(result);
      setTrackApplicationStatus(`Loaded application ${result.id}`);
    } catch (error) {
      setTrackApplicationError(error instanceof Error ? error.message : 'Unable to load application');
      setTrackApplicationStatus('');
    } finally {
      setTrackApplicationLoading(false);
    }
  }

  async function handleDocumentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDocumentLoading(true);
    setDocumentError('');
    setDocumentStatus('Uploading metadata...');

    try {
      const result = await addDocument(documentForm.application_id, {
        document_type: documentForm.document_type,
        filename: documentForm.filename,
        uploaded_by_applicant_id: documentForm.uploaded_by_applicant_id,
      });

      setDocumentResult(result);
      setDocumentStatus(`Document metadata added: ${result.id}`);
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Unable to add document');
      setDocumentStatus('');
    } finally {
      setDocumentLoading(false);
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommentLoading(true);
    setCommentError('');
    setCommentStatus('Adding comment...');

    try {
      const result = await addComment(commentForm.application_id, {
        applicant_id: commentForm.applicant_id,
        comment_text: commentForm.comment_text,
      });

      setCommentResult(result);
      setCommentStatus(`Comment saved: ${result.id}`);
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : 'Unable to add comment');
      setCommentStatus('');
    } finally {
      setCommentLoading(false);
    }
  }

  async function handleObjectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setObjectionLoading(true);
    setObjectionError('');
    setObjectionStatus('Submitting objection...');

    try {
      const result = await addObjection(objectionForm.application_id, {
        applicant_id: objectionForm.applicant_id,
        reason: objectionForm.reason,
        supporting_document_filename: objectionForm.supporting_document_filename || undefined,
      });

      setObjectionResult(result);
      setObjectionStatus(`Objection submitted: ${result.id}`);
    } catch (error) {
      setObjectionError(error instanceof Error ? error.message : 'Unable to submit objection');
      setObjectionStatus('');
    } finally {
      setObjectionLoading(false);
    }
  }

  async function handleTimelineSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTimelineLoading(true);
    setTimelineError('');
    setTimelineStatus('Loading timeline...');

    try {
      const result = await getTimeline(timelineApplicationId);
      setTimelineResult(result);
      setTimelineStatus(`Loaded ${result.length} timeline events`);
    } catch (error) {
      setTimelineError(error instanceof Error ? error.message : 'Unable to load timeline');
      setTimelineStatus('');
    } finally {
      setTimelineLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">COMP4382 Final Project</p>
          <h1>LRMIS - Land Registration Management Information System</h1>
          <p className="hero-copy">
            Student 2 module: Applicant Portal and Profiles. Use the tabs below to create applicants, submit simple land applications, and track their records.
          </p>
        </div>
        <div className="hero-card">
          <span>Active view</span>
          <strong>{activeLabel}</strong>
          <p>Backend: FastAPI + PyMongo</p>
          <p>Frontend: React + TypeScript + Vite</p>
        </div>
      </header>

      <nav className="tab-bar">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" className={tab.key === activeTab ? 'tab active' : 'tab'} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'create-applicant' && (
        <section className="card">
          <h2>Create Applicant</h2>
          <form className="grid-form" onSubmit={handleApplicantSubmit}>
            <label>
              Full name
              <input value={applicantForm.full_name} onChange={(event) => setApplicantForm({ ...applicantForm, full_name: event.target.value })} required />
            </label>
            <label>
              Applicant type
              <select value={applicantForm.applicant_type} onChange={(event) => setApplicantForm({ ...applicantForm, applicant_type: event.target.value as ApplicantType })}>
                {applicantTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              National ID
              <input value={applicantForm.national_id} onChange={(event) => setApplicantForm({ ...applicantForm, national_id: event.target.value })} />
            </label>
            <label>
              Registration number
              <input value={applicantForm.registration_number} onChange={(event) => setApplicantForm({ ...applicantForm, registration_number: event.target.value })} />
            </label>
            <label>
              Email
              <input type="email" value={applicantForm.email} onChange={(event) => setApplicantForm({ ...applicantForm, email: event.target.value })} required />
            </label>
            <label>
              Phone
              <input value={applicantForm.phone} onChange={(event) => setApplicantForm({ ...applicantForm, phone: event.target.value })} required />
            </label>
            <label>
              City
              <input value={applicantForm.city} onChange={(event) => setApplicantForm({ ...applicantForm, city: event.target.value })} required />
            </label>
            <label>
              Zone ID
              <input value={applicantForm.zone_id} onChange={(event) => setApplicantForm({ ...applicantForm, zone_id: event.target.value })} />
            </label>
            <label>
              Preferred language
              <input value={applicantForm.preferred_language} onChange={(event) => setApplicantForm({ ...applicantForm, preferred_language: event.target.value })} />
            </label>
            <label>
              Notification method
              <select value={applicantForm.notification_method} onChange={(event) => setApplicantForm({ ...applicantForm, notification_method: event.target.value as 'email' | 'sms' })}>
                <option value="email">email</option>
                <option value="sms">sms</option>
              </select>
            </label>
            <button type="submit" disabled={applicantLoading}>
              {applicantLoading ? 'Saving...' : 'Create applicant'}
            </button>
          </form>
          {applicantStatus && <p className="status">{applicantStatus}</p>}
          {applicantError && <p className="error">{applicantError}</p>}
          <JsonBlock title="Created applicant" value={applicantResult} />
        </section>
      )}

      {activeTab === 'submit-application' && (
        <section className="card">
          <h2>Submit Application</h2>
          <form className="grid-form" onSubmit={handleApplicationSubmit}>
            <label>
              Applicant ID
              <input value={applicationForm.applicant_id} onChange={(event) => setApplicationForm({ ...applicationForm, applicant_id: event.target.value })} required />
            </label>
            <label>
              Application type
              <select value={applicationForm.application_type} onChange={(event) => setApplicationForm({ ...applicationForm, application_type: event.target.value as ApplicationType })}>
                {applicationTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Parcel number
              <input value={applicationForm.parcel_number} onChange={(event) => setApplicationForm({ ...applicationForm, parcel_number: event.target.value })} required />
            </label>
            <label>
              Block number
              <input value={applicationForm.block_number} onChange={(event) => setApplicationForm({ ...applicationForm, block_number: event.target.value })} required />
            </label>
            <label>
              Basin number
              <input value={applicationForm.basin_number} onChange={(event) => setApplicationForm({ ...applicationForm, basin_number: event.target.value })} required />
            </label>
            <label>
              Zone ID
              <input value={applicationForm.zone_id} onChange={(event) => setApplicationForm({ ...applicationForm, zone_id: event.target.value })} required />
            </label>
            <label className="full-width">
              Description
              <textarea value={applicationForm.description} onChange={(event) => setApplicationForm({ ...applicationForm, description: event.target.value })} rows={4} />
            </label>
            <button type="submit" disabled={applicationLoading}>
              {applicationLoading ? 'Submitting...' : 'Submit application'}
            </button>
          </form>
          {applicationStatus && <p className="status">{applicationStatus}</p>}
          {applicationError && <p className="error">{applicationError}</p>}
          <JsonBlock title="Created application" value={applicationResult} />
        </section>
      )}

      {activeTab === 'my-applications' && (
        <section className="card">
          <h2>My Applications</h2>
          <form className="inline-form" onSubmit={handleApplicationsLookup}>
            <label>
              Applicant ID
              <input value={lookupApplicantId} onChange={(event) => setLookupApplicantId(event.target.value)} required />
            </label>
            <button type="submit" disabled={lookupLoading}>
              {lookupLoading ? 'Loading...' : 'Load applications'}
            </button>
          </form>
          {lookupStatus && <p className="status">{lookupStatus}</p>}
          {lookupError && <p className="error">{lookupError}</p>}
          <JsonBlock title="Applications" value={lookupApplications} />
        </section>
      )}

      {activeTab === 'track-application' && (
        <section className="card">
          <h2>Track Application</h2>
          <form className="inline-form" onSubmit={handleTrackApplication}>
            <label>
              Application ID
              <input value={trackApplicationId} onChange={(event) => setTrackApplicationId(event.target.value)} required />
            </label>
            <button type="submit" disabled={trackApplicationLoading}>
              {trackApplicationLoading ? 'Loading...' : 'Load application'}
            </button>
          </form>
          {trackApplicationStatus && <p className="status">{trackApplicationStatus}</p>}
          {trackApplicationError && <p className="error">{trackApplicationError}</p>}
          <JsonBlock title="Application details" value={trackApplicationResult} />
        </section>
      )}

      {activeTab === 'upload-document' && (
        <section className="card">
          <h2>Upload Document Metadata</h2>
          <form className="grid-form" onSubmit={handleDocumentSubmit}>
            <label>
              Application ID
              <input value={documentForm.application_id} onChange={(event) => setDocumentForm({ ...documentForm, application_id: event.target.value })} required />
            </label>
            <label>
              Document type
              <input value={documentForm.document_type} onChange={(event) => setDocumentForm({ ...documentForm, document_type: event.target.value })} required />
            </label>
            <label>
              Filename
              <input value={documentForm.filename} onChange={(event) => setDocumentForm({ ...documentForm, filename: event.target.value })} required />
            </label>
            <label>
              Uploaded by applicant ID
              <input value={documentForm.uploaded_by_applicant_id} onChange={(event) => setDocumentForm({ ...documentForm, uploaded_by_applicant_id: event.target.value })} required />
            </label>
            <button type="submit" disabled={documentLoading}>
              {documentLoading ? 'Saving...' : 'Save document metadata'}
            </button>
          </form>
          {documentStatus && <p className="status">{documentStatus}</p>}
          {documentError && <p className="error">{documentError}</p>}
          <JsonBlock title="Document record" value={documentResult} />
        </section>
      )}

      {activeTab === 'add-comment' && (
        <section className="card">
          <h2>Add Comment</h2>
          <form className="grid-form" onSubmit={handleCommentSubmit}>
            <label>
              Application ID
              <input value={commentForm.application_id} onChange={(event) => setCommentForm({ ...commentForm, application_id: event.target.value })} required />
            </label>
            <label>
              Applicant ID
              <input value={commentForm.applicant_id} onChange={(event) => setCommentForm({ ...commentForm, applicant_id: event.target.value })} required />
            </label>
            <label className="full-width">
              Comment text
              <textarea value={commentForm.comment_text} onChange={(event) => setCommentForm({ ...commentForm, comment_text: event.target.value })} rows={4} required />
            </label>
            <button type="submit" disabled={commentLoading}>
              {commentLoading ? 'Saving...' : 'Save comment'}
            </button>
          </form>
          {commentStatus && <p className="status">{commentStatus}</p>}
          {commentError && <p className="error">{commentError}</p>}
          <JsonBlock title="Comment record" value={commentResult} />
        </section>
      )}

      {activeTab === 'submit-objection' && (
        <section className="card">
          <h2>Submit Objection</h2>
          <form className="grid-form" onSubmit={handleObjectionSubmit}>
            <label>
              Application ID
              <input value={objectionForm.application_id} onChange={(event) => setObjectionForm({ ...objectionForm, application_id: event.target.value })} required />
            </label>
            <label>
              Applicant ID
              <input value={objectionForm.applicant_id} onChange={(event) => setObjectionForm({ ...objectionForm, applicant_id: event.target.value })} required />
            </label>
            <label className="full-width">
              Reason
              <textarea value={objectionForm.reason} onChange={(event) => setObjectionForm({ ...objectionForm, reason: event.target.value })} rows={4} required />
            </label>
            <label>
              Supporting document filename
              <input value={objectionForm.supporting_document_filename} onChange={(event) => setObjectionForm({ ...objectionForm, supporting_document_filename: event.target.value })} />
            </label>
            <button type="submit" disabled={objectionLoading}>
              {objectionLoading ? 'Submitting...' : 'Submit objection'}
            </button>
          </form>
          {objectionStatus && <p className="status">{objectionStatus}</p>}
          {objectionError && <p className="error">{objectionError}</p>}
          <JsonBlock title="Objection record" value={objectionResult} />
        </section>
      )}

      {activeTab === 'timeline' && (
        <section className="card">
          <h2>Timeline</h2>
          <form className="inline-form" onSubmit={handleTimelineSubmit}>
            <label>
              Application ID
              <input value={timelineApplicationId} onChange={(event) => setTimelineApplicationId(event.target.value)} required />
            </label>
            <button type="submit" disabled={timelineLoading}>
              {timelineLoading ? 'Loading...' : 'Load timeline'}
            </button>
          </form>
          {timelineStatus && <p className="status">{timelineStatus}</p>}
          {timelineError && <p className="error">{timelineError}</p>}
          <JsonBlock title="Timeline events" value={timelineResult} />
        </section>
      )}
    </div>
  );
}

export default App;
