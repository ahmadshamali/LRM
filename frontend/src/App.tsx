import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  addComment,
  addDocument,
  addObjection,
  autoAssignSurveyor,
  createApplicant,
  createApplication,
  createStaff,
  getApplication,
  getApplicant,
  getCurrentAccount,
  getStoredAuthToken,
  getTimeline,
  getStaff,
  listApplications,
  listSharedApplications,
  listStaff,
  listSurveyTasks,
  loginAccount,
  logoutAccount,
  registrarReview,
  registerAccount,
  setStoredAuthToken,
  updateSurveyMilestone,
  uploadSurveyReport,
} from './api';
import AnalyticsPage from './AnalyticsPage';
import type { ApplicationType, ApplicantType, AuthSession, RegistrarDecision, StaffRole, SurveyMilestone } from './types';

type TabKey =
  | 'dashboard'
  | 'create-applicant'
  | 'submit-application'
  | 'all-applications'
  | 'my-applications'
  | 'track-application'
  | 'upload-document'
  | 'add-comment'
  | 'submit-objection'
  | 'timeline'
  | 'create-staff'
  | 'staff-list'
  | 'staff-detail'
  | 'auto-assign'
  | 'survey-tasks'
  | 'survey-milestone'
  | 'survey-report'
  | 'registrar-review'
  | 'analytics-map';

const tabs: { key: TabKey; label: string; group: string }[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Home' },
  { key: 'create-applicant', label: 'Create Applicant', group: 'Applicant' },
  { key: 'submit-application', label: 'Submit Application', group: 'Applicant' },
  { key: 'all-applications', label: 'All Applications', group: 'Applicant' },
  { key: 'my-applications', label: 'My Applications', group: 'Applicant' },
  { key: 'track-application', label: 'Track Application', group: 'Applicant' },
  { key: 'upload-document', label: 'Upload Document Metadata', group: 'Applicant' },
  { key: 'add-comment', label: 'Add Comment', group: 'Applicant' },
  { key: 'submit-objection', label: 'Submit Objection', group: 'Applicant' },
  { key: 'timeline', label: 'Timeline', group: 'Applicant' },
  { key: 'create-staff', label: 'Create Staff', group: 'Staff Operations' },
  { key: 'staff-list', label: 'Staff List', group: 'Staff Operations' },
  { key: 'staff-detail', label: 'Staff Detail', group: 'Staff Operations' },
  { key: 'auto-assign', label: 'Auto Assign Surveyor', group: 'Staff Operations' },
  { key: 'survey-tasks', label: 'Survey Tasks', group: 'Staff Operations' },
  { key: 'survey-milestone', label: 'Survey Milestone', group: 'Staff Operations' },
  { key: 'survey-report', label: 'Survey Report', group: 'Staff Operations' },
  { key: 'registrar-review', label: 'Registrar Review', group: 'Staff Operations' },
  { key: 'analytics-map', label: 'Analytics and Map', group: 'Analytics & Maps' },
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
const staffRoles: StaffRole[] = ['surveyor', 'registrar'];
const milestones: SurveyMilestone[] = ['visit_scheduled', 'arrived_on_site', 'survey_started', 'survey_completed'];
const registrarDecisions: RegistrarDecision[] = ['accepted', 'rejected', 'needs_revision'];

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

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const dashboardGroups: Array<{
  title: string;
  tone: 'blue' | 'green' | 'purple';
  cards: Array<{ tab: TabKey; title: string; description: string; icon: string; accent: string }>;
}> = [
  {
    title: 'Applicant Portal',
    tone: 'blue',
    cards: [
      { tab: 'create-applicant', title: 'Create Applicant', description: 'Register a new applicant profile.', icon: 'ID', accent: 'blue' },
      { tab: 'submit-application', title: 'Create Application', description: 'Start a new land registration application.', icon: 'DOC', accent: 'blue' },
      { tab: 'all-applications', title: 'All Applications', description: 'Browse and filter submitted applications.', icon: 'LIST', accent: 'mint' },
      { tab: 'my-applications', title: 'My Applications', description: 'View applications for one applicant.', icon: 'FILE', accent: 'mint' },
      { tab: 'track-application', title: 'Track Application', description: 'Track status and progress.', icon: 'FIND', accent: 'violet' },
      { tab: 'upload-document', title: 'Upload Documents', description: 'Upload required document metadata.', icon: 'UP', accent: 'amber' },
      { tab: 'add-comment', title: 'Add Comment', description: 'Add an applicant comment.', icon: 'MSG', accent: 'cyan' },
      { tab: 'submit-objection', title: 'Submit Objection', description: 'Submit an objection for an application.', icon: '!', accent: 'red' },
      { tab: 'timeline', title: 'Timeline', description: 'View application timeline events.', icon: 'CLK', accent: 'cyan' },
    ],
  },
  {
    title: 'Staff Operations',
    tone: 'green',
    cards: [
      { tab: 'create-staff', title: 'Staff Management', description: 'Create and manage staff members.', icon: 'USR', accent: 'mint' },
      { tab: 'staff-list', title: 'Staff List', description: 'View staff by role and activity.', icon: 'TEAM', accent: 'blue' },
      { tab: 'staff-detail', title: 'Staff Detail', description: 'Open one staff profile and summary.', icon: 'ID', accent: 'violet' },
      { tab: 'auto-assign', title: 'Auto Assign Surveyor', description: 'Assign a surveyor by zone and workload.', icon: 'AUTO', accent: 'amber' },
      { tab: 'survey-tasks', title: 'Survey Tasks', description: 'View and manage survey tasks.', icon: 'TASK', accent: 'blue' },
      { tab: 'survey-milestone', title: 'Survey Milestones', description: 'Track survey milestones.', icon: 'FLAG', accent: 'violet' },
      { tab: 'survey-report', title: 'Survey Reports', description: 'View and manage survey reports.', icon: 'REP', accent: 'amber' },
      { tab: 'registrar-review', title: 'Registrar Reviews', description: 'Review and process applications.', icon: 'OK', accent: 'red' },
    ],
  },
  {
    title: 'Analytics & Maps',
    tone: 'purple',
    cards: [
      { tab: 'analytics-map', title: 'Dashboard Analytics', description: 'View key metrics and system KPIs.', icon: 'PIE', accent: 'violet' },
      { tab: 'analytics-map', title: 'Parcel Map Viewer', description: 'Explore parcels on the interactive map.', icon: 'MAP', accent: 'mint' },
      { tab: 'analytics-map', title: 'Workload Analysis', description: 'Analyze workload of staff and surveyors.', icon: 'BAR', accent: 'blue' },
      { tab: 'analytics-map', title: 'Application Statistics', description: 'View statistics and trends.', icon: 'LINE', accent: 'amber' },
    ],
  },
];

const sideNavItems: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'dashboard', label: 'Dashboard', icon: 'HOME' },
  { key: 'create-applicant', label: 'Applicants', icon: 'USER' },
  { key: 'create-staff', label: 'Staff Operations', icon: 'TEAM' },
  { key: 'analytics-map', label: 'Analytics', icon: 'BAR' },
  { key: 'analytics-map', label: 'Maps', icon: 'MAP' },
];

function Dashboard({ onSelect }: { onSelect: (tab: TabKey) => void }) {
  return (
    <section className="dashboard-view">
      <div className="welcome-block">
        <h1>Welcome to LRMIS</h1>
        <p>Manage land registration applications, surveys, reviews and access analytics through a simple and organized platform.</p>
      </div>

      {dashboardGroups.map((group) => (
        <section className="feature-section" key={group.title}>
          <h2 className={`section-title ${group.tone}`}>{group.title}</h2>
          <div className="feature-grid">
            {group.cards.map((card) => (
              <button className="feature-card" key={`${group.title}-${card.title}`} type="button" onClick={() => onSelect(card.tab)}>
                <span className={`feature-icon ${card.accent}`}>{card.icon}</span>
                <strong>{card.title}</strong>
                <span>{card.description}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [accountForm, setAccountForm] = useState({
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
    password: '',
    confirm_password: '',
  });

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setStatusMessage('Signing in...');

    try {
      const session = await loginAccount(loginForm);
      setStatusMessage('Signed in');
      onAuthenticated(session);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in');
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setStatusMessage('Creating account...');

    if (accountForm.password !== accountForm.confirm_password) {
      setLoading(false);
      setStatusMessage('');
      setErrorMessage('Passwords do not match');
      return;
    }

    try {
      const session = await registerAccount({
        full_name: accountForm.full_name,
        applicant_type: accountForm.applicant_type,
        national_id: accountForm.national_id || undefined,
        registration_number: accountForm.registration_number || undefined,
        email: accountForm.email,
        phone: accountForm.phone,
        city: accountForm.city,
        zone_id: accountForm.zone_id || undefined,
        preferred_language: accountForm.preferred_language,
        notification_method: accountForm.notification_method,
        password: accountForm.password,
      });
      setStatusMessage('Account created');
      onAuthenticated(session);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create account');
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <span>LR</span>
          <div>
            <strong>LRMIS</strong>
            <p>Land Registration Management Information System</p>
          </div>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button>
        </div>

        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>Email<input type="email" value={loginForm.email} onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })} required /></label>
            <label>Password<input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} required /></label>
            <button type="submit" disabled={loading}>Sign in</button>
          </form>
        ) : (
          <form className="grid-form auth-form-grid" onSubmit={handleRegister}>
            <label>Full name<input value={accountForm.full_name} onChange={(event) => setAccountForm({ ...accountForm, full_name: event.target.value })} required /></label>
            <label>Applicant type<select value={accountForm.applicant_type} onChange={(event) => setAccountForm({ ...accountForm, applicant_type: event.target.value as ApplicantType })}>{applicantTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label>National ID<input value={accountForm.national_id} onChange={(event) => setAccountForm({ ...accountForm, national_id: event.target.value })} /></label>
            <label>Registration number<input value={accountForm.registration_number} onChange={(event) => setAccountForm({ ...accountForm, registration_number: event.target.value })} /></label>
            <label>Email<input type="email" value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} required /></label>
            <label>Phone<input value={accountForm.phone} onChange={(event) => setAccountForm({ ...accountForm, phone: event.target.value })} required /></label>
            <label>City<input value={accountForm.city} onChange={(event) => setAccountForm({ ...accountForm, city: event.target.value })} required /></label>
            <label>Zone ID<input value={accountForm.zone_id} onChange={(event) => setAccountForm({ ...accountForm, zone_id: event.target.value })} /></label>
            <label>Preferred language<input value={accountForm.preferred_language} onChange={(event) => setAccountForm({ ...accountForm, preferred_language: event.target.value })} /></label>
            <label>Notification method<select value={accountForm.notification_method} onChange={(event) => setAccountForm({ ...accountForm, notification_method: event.target.value as 'email' | 'sms' })}><option value="email">email</option><option value="sms">sms</option></select></label>
            <label>Password<input type="password" minLength={8} value={accountForm.password} onChange={(event) => setAccountForm({ ...accountForm, password: event.target.value })} required /></label>
            <label>Confirm password<input type="password" minLength={8} value={accountForm.confirm_password} onChange={(event) => setAccountForm({ ...accountForm, confirm_password: event.target.value })} required /></label>
            <button type="submit" disabled={loading}>Create account</button>
          </form>
        )}

        {statusMessage && <p className="status">{statusMessage}</p>}
        {errorMessage && <p className="error">{errorMessage}</p>}
      </section>
    </main>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const activeLabel = useMemo(() => tabs.find((tab) => tab.key === activeTab)?.label ?? '', [activeTab]);
  const activeGroup = useMemo(() => tabs.find((tab) => tab.key === activeTab)?.group ?? '', [activeTab]);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authChecking, setAuthChecking] = useState(Boolean(getStoredAuthToken()));

  function isSideNavActive(item: { key: TabKey; label: string }) {
    if (item.label === 'Applicants') {
      return activeGroup === 'Applicant';
    }
    if (item.label === 'Staff Operations') {
      return activeGroup === 'Staff Operations';
    }
    if (item.label === 'Analytics') {
      return activeTab === 'analytics-map';
    }
    if (item.label === 'Maps') {
      return false;
    }
    return item.key === activeTab;
  }

  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultTitle, setResultTitle] = useState('Result');
  const [result, setResult] = useState<unknown>(null);

  function startAction(message: string) {
    setLoading(true);
    setStatusMessage(message);
    setErrorMessage('');
    setResult(null);
  }

  function finishAction(title: string, value: unknown, message: string) {
    setResultTitle(title);
    setResult(value);
    setStatusMessage(message);
    setLoading(false);
  }

  function failAction(error: unknown, fallback: string) {
    setErrorMessage(error instanceof Error ? error.message : fallback);
    setStatusMessage('');
    setLoading(false);
  }

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

  const [applicationForm, setApplicationForm] = useState({
    applicant_id: '',
    application_type: 'first_registration' as ApplicationType,
    parcel_number: '',
    block_number: '',
    basin_number: '',
    zone_id: '',
    description: '',
  });

  const [lookupApplicantId, setLookupApplicantId] = useState('');
  const [trackApplicationId, setTrackApplicationId] = useState('');
  const [timelineApplicationId, setTimelineApplicationId] = useState('');
  const [sharedApplicationFilters, setSharedApplicationFilters] = useState({
    applicant_id: '',
    status: '',
    application_type: '' as '' | ApplicationType,
    zone_id: '',
  });

  const [documentForm, setDocumentForm] = useState({
    application_id: '',
    document_type: '',
    filename: '',
    uploaded_by_applicant_id: '',
  });

  const [commentForm, setCommentForm] = useState({
    application_id: '',
    applicant_id: '',
    comment_text: '',
  });

  const [objectionForm, setObjectionForm] = useState({
    application_id: '',
    applicant_id: '',
    reason: '',
    supporting_document_filename: '',
  });

  const [staffForm, setStaffForm] = useState({
    staff_code: 'SURV-RM-01',
    name: 'Survey Team A',
    role: 'surveyor' as StaffRole,
    department: 'Cadastral Survey',
    skills: 'boundary_survey, parcel_subdivision, gps_mapping',
    zone_ids: 'ZONE-RM-01, ZONE-RM-02',
    max_tasks: '10',
    phone: '+970599111111',
    email: 'survey_a@example.com',
  });

  const [staffListFilters, setStaffListFilters] = useState({ role: '' as '' | StaffRole, active: 'true' });
  const [staffDetailId, setStaffDetailId] = useState('');
  const [taskFilters, setTaskFilters] = useState({ surveyor_id: '', application_id: '', status: '' });

  const [assignForm, setAssignForm] = useState({
    application_id: '',
    required_skill: 'boundary_survey',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
  });

  const [milestoneForm, setMilestoneForm] = useState({
    application_id: '',
    by_staff_id: '',
    milestone: 'visit_scheduled' as SurveyMilestone,
    scheduled_visit_date: '',
    notes: '',
  });

  const [reportForm, setReportForm] = useState({
    application_id: '',
    report_title: 'Boundary Survey Report',
    uploaded_by_staff_id: '',
    file_name: 'survey-report.pdf',
    file_url: '',
    summary: '',
    findings: '',
  });

  const [reviewForm, setReviewForm] = useState({
    application_id: '',
    registrar_staff_id: '',
    decision: 'accepted' as RegistrarDecision,
    notes: '',
  });

  function applyAuthenticatedSession(session: AuthSession) {
    setAuthSession(session);
    setApplicantForm((current) => ({
      ...current,
      full_name: session.applicant.full_name,
      applicant_type: session.applicant.applicant_type,
      national_id: session.applicant.national_id ?? '',
      registration_number: session.applicant.registration_number ?? '',
      email: session.applicant.email,
      phone: session.applicant.phone,
      city: session.applicant.city,
      zone_id: session.applicant.zone_id ?? '',
      preferred_language: session.applicant.preferred_language,
      notification_method: session.applicant.notification_method,
    }));
    setApplicationForm((current) => ({ ...current, applicant_id: session.applicant.id }));
    setLookupApplicantId(session.applicant.id);
    setDocumentForm((current) => ({ ...current, uploaded_by_applicant_id: session.applicant.id }));
    setCommentForm((current) => ({ ...current, applicant_id: session.applicant.id }));
    setObjectionForm((current) => ({ ...current, applicant_id: session.applicant.id }));
  }

  useEffect(() => {
    if (!getStoredAuthToken()) {
      setAuthChecking(false);
      return;
    }

    getCurrentAccount()
      .then(applyAuthenticatedSession)
      .catch(() => {
        setStoredAuthToken('');
        setAuthSession(null);
      })
      .finally(() => setAuthChecking(false));
  }, []);

  async function handleApplicantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (authSession) {
      finishAction('Applicant profile', authSession.applicant, `Signed in as applicant: ${authSession.applicant.id}`);
      return;
    }

    startAction('Creating applicant...');

    try {
      const created = await createApplicant({
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
      finishAction('Created applicant', created, `Applicant created: ${created.id}`);
    } catch (error) {
      failAction(error, 'Unable to create applicant');
    }
  }

  async function handleApplicationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Submitting application...');

    try {
      const applicantId = authSession?.applicant.id ?? applicationForm.applicant_id;
      const created = await createApplication({
        applicant_id: applicantId,
        application_type: applicationForm.application_type,
        parcel_number: applicationForm.parcel_number,
        block_number: applicationForm.block_number,
        basin_number: applicationForm.basin_number,
        zone_id: applicationForm.zone_id,
        description: applicationForm.description || undefined,
      });
      finishAction('Created application', created, `Application submitted: ${created.id}`);
    } catch (error) {
      failAction(error, 'Unable to submit application');
    }
  }

  async function handleApplicationsLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Loading applications...');

    try {
      const applicantId = authSession?.applicant.id ?? lookupApplicantId;
      await getApplicant(applicantId);
      const applications = await listApplications(applicantId);
      finishAction('Applications', applications, `Loaded ${applications.length} applications`);
    } catch (error) {
      failAction(error, 'Unable to load applications');
    }
  }

  async function handleSharedApplicationsLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Loading shared applications...');

    try {
      const applications = await listSharedApplications({
        applicant_id: sharedApplicationFilters.applicant_id || undefined,
        status: sharedApplicationFilters.status || undefined,
        application_type: sharedApplicationFilters.application_type || undefined,
        zone_id: sharedApplicationFilters.zone_id || undefined,
      });
      finishAction('All applications', applications, `Loaded ${applications.length} applications`);
    } catch (error) {
      failAction(error, 'Unable to load shared applications');
    }
  }

  async function handleTrackApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Loading application...');

    try {
      const application = await getApplication(trackApplicationId);
      finishAction('Application details', application, `Loaded application ${application.id}`);
    } catch (error) {
      failAction(error, 'Unable to load application');
    }
  }

  async function handleDocumentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Saving document metadata...');

    try {
      const document = await addDocument(documentForm.application_id, {
        document_type: documentForm.document_type,
        filename: documentForm.filename,
        uploaded_by_applicant_id: authSession?.applicant.id ?? documentForm.uploaded_by_applicant_id,
      });
      finishAction('Document record', document, `Document metadata added: ${document.id}`);
    } catch (error) {
      failAction(error, 'Unable to add document');
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Saving comment...');

    try {
      const comment = await addComment(commentForm.application_id, {
        applicant_id: authSession?.applicant.id ?? commentForm.applicant_id,
        comment_text: commentForm.comment_text,
      });
      finishAction('Comment record', comment, `Comment saved: ${comment.id}`);
    } catch (error) {
      failAction(error, 'Unable to add comment');
    }
  }

  async function handleObjectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Submitting objection...');

    try {
      const objection = await addObjection(objectionForm.application_id, {
        applicant_id: authSession?.applicant.id ?? objectionForm.applicant_id,
        reason: objectionForm.reason,
        supporting_document_filename: objectionForm.supporting_document_filename || undefined,
      });
      finishAction('Objection record', objection, `Objection submitted: ${objection.id}`);
    } catch (error) {
      failAction(error, 'Unable to submit objection');
    }
  }

  async function handleTimelineSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Loading timeline...');

    try {
      const events = await getTimeline(timelineApplicationId);
      finishAction('Timeline events', events, `Loaded ${events.length} timeline events`);
    } catch (error) {
      failAction(error, 'Unable to load timeline');
    }
  }

  async function handleStaffSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Creating staff member...');

    try {
      const staff = await createStaff({
        staff_code: staffForm.staff_code,
        name: staffForm.name,
        role: staffForm.role,
        department: staffForm.department || undefined,
        skills: splitCsv(staffForm.skills),
        zone_ids: splitCsv(staffForm.zone_ids),
        max_tasks: Number(staffForm.max_tasks || 10),
        phone: staffForm.phone || undefined,
        email: staffForm.email || undefined,
        active: true,
      });
      finishAction('Created staff member', staff, `Staff created: ${staff.id}`);
    } catch (error) {
      failAction(error, 'Unable to create staff member');
    }
  }

  async function handleStaffList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Loading staff...');

    try {
      const staff = await listStaff({
        role: staffListFilters.role || undefined,
        active: staffListFilters.active === '' ? undefined : staffListFilters.active === 'true',
      });
      finishAction('Staff members', staff, `Loaded ${staff.length} staff members`);
    } catch (error) {
      failAction(error, 'Unable to load staff members');
    }
  }

  async function handleStaffDetail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Loading staff profile...');

    try {
      const staff = await getStaff(staffDetailId);
      finishAction('Staff profile', staff, `Loaded staff member ${staff.id}`);
    } catch (error) {
      failAction(error, 'Unable to load staff member');
    }
  }

  async function handleTaskList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Loading survey tasks...');

    try {
      const tasks = await listSurveyTasks({
        surveyor_id: taskFilters.surveyor_id || undefined,
        application_id: taskFilters.application_id || undefined,
        status: taskFilters.status || undefined,
      });
      finishAction('Survey tasks', tasks, `Loaded ${tasks.length} survey tasks`);
    } catch (error) {
      failAction(error, 'Unable to load survey tasks');
    }
  }

  async function handleAutoAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Assigning surveyor...');

    try {
      const assigned = await autoAssignSurveyor(assignForm.application_id, {
        required_skill: assignForm.required_skill || undefined,
        priority: assignForm.priority,
      });
      finishAction('Auto assignment result', assigned, assigned.message);
    } catch (error) {
      failAction(error, 'Unable to auto-assign surveyor');
    }
  }

  async function handleMilestoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Updating survey milestone...');

    try {
      const task = await updateSurveyMilestone(milestoneForm.application_id, {
        milestone: milestoneForm.milestone,
        by_staff_id: milestoneForm.by_staff_id,
        scheduled_visit_date: milestoneForm.scheduled_visit_date || undefined,
        notes: milestoneForm.notes || undefined,
      });
      finishAction('Updated survey task', task, `Milestone saved: ${task.status}`);
    } catch (error) {
      failAction(error, 'Unable to update survey milestone');
    }
  }

  async function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Uploading survey report metadata...');

    try {
      const report = await uploadSurveyReport(reportForm.application_id, {
        report_title: reportForm.report_title,
        uploaded_by_staff_id: reportForm.uploaded_by_staff_id,
        file_name: reportForm.file_name || undefined,
        file_url: reportForm.file_url || undefined,
        summary: reportForm.summary || undefined,
        findings: reportForm.findings || undefined,
      });
      finishAction('Survey report', report, `Survey report uploaded: ${report.id}`);
    } catch (error) {
      failAction(error, 'Unable to upload survey report metadata');
    }
  }

  async function handleRegistrarReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startAction('Saving registrar review...');

    try {
      const task = await registrarReview(reviewForm.application_id, {
        registrar_staff_id: reviewForm.registrar_staff_id,
        decision: reviewForm.decision,
        notes: reviewForm.notes || undefined,
      });
      finishAction('Registrar review result', task, `Registrar review saved: ${task.status}`);
    } catch (error) {
      failAction(error, 'Unable to save registrar review');
    }
  }

  async function handleSignOut() {
    await logoutAccount();
    setAuthSession(null);
    setActiveTab('dashboard');
    setStatusMessage('');
    setErrorMessage('');
    setResult(null);
  }

  if (authChecking) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div className="auth-brand">
            <span>LR</span>
            <div>
              <strong>LRMIS</strong>
              <p>Checking your session...</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!authSession) {
    return <AuthScreen onAuthenticated={applyAuthenticatedSession} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <span>LR</span>
          <strong>LRMIS</strong>
        </div>
        <nav className="side-nav">
          {sideNavItems.map((item) => (
            <button key={`${item.label}-${item.key}`} type="button" className={isSideNavActive(item) ? 'side-link active' : 'side-link'} onClick={() => setActiveTab(item.key)}>
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <strong>Land Registration Management Information System</strong>
          <div className="user-menu">
            <span>{authSession.applicant.full_name.slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{authSession.applicant.full_name}</strong>
              <small>{authSession.account.email}</small>
            </div>
            <button type="button" className="ghost-button" onClick={handleSignOut}>Sign out</button>
          </div>
        </header>

        <div className="content-shell">
          {activeTab !== 'dashboard' && (
            <div className="view-heading">
              <button type="button" className="back-link" onClick={() => setActiveTab('dashboard')}>Dashboard</button>
              <div>
                <span>{tabs.find((tab) => tab.key === activeTab)?.group}</span>
                <h1>{activeLabel}</h1>
              </div>
            </div>
          )}

      {activeTab === 'dashboard' && <Dashboard onSelect={setActiveTab} />}

      {activeTab === 'create-applicant' && (
        <section className="card">
          <h2>Applicant Profile</h2>
          <p>This profile is connected to the signed-in account.</p>
          <form className="grid-form" onSubmit={handleApplicantSubmit}>
            <label>Full name<input value={applicantForm.full_name} onChange={(event) => setApplicantForm({ ...applicantForm, full_name: event.target.value })} required /></label>
            <label>Applicant type<select value={applicantForm.applicant_type} onChange={(event) => setApplicantForm({ ...applicantForm, applicant_type: event.target.value as ApplicantType })}>{applicantTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label>National ID<input value={applicantForm.national_id} onChange={(event) => setApplicantForm({ ...applicantForm, national_id: event.target.value })} /></label>
            <label>Registration number<input value={applicantForm.registration_number} onChange={(event) => setApplicantForm({ ...applicantForm, registration_number: event.target.value })} /></label>
            <label>Email<input type="email" value={applicantForm.email} onChange={(event) => setApplicantForm({ ...applicantForm, email: event.target.value })} required /></label>
            <label>Phone<input value={applicantForm.phone} onChange={(event) => setApplicantForm({ ...applicantForm, phone: event.target.value })} required /></label>
            <label>City<input value={applicantForm.city} onChange={(event) => setApplicantForm({ ...applicantForm, city: event.target.value })} required /></label>
            <label>Zone ID<input value={applicantForm.zone_id} onChange={(event) => setApplicantForm({ ...applicantForm, zone_id: event.target.value })} /></label>
            <label>Preferred language<input value={applicantForm.preferred_language} onChange={(event) => setApplicantForm({ ...applicantForm, preferred_language: event.target.value })} /></label>
            <label>Notification method<select value={applicantForm.notification_method} onChange={(event) => setApplicantForm({ ...applicantForm, notification_method: event.target.value as 'email' | 'sms' })}><option value="email">email</option><option value="sms">sms</option></select></label>
            <button type="submit" disabled={loading}>{authSession ? 'Show profile' : 'Create applicant'}</button>
          </form>
        </section>
      )}

      {activeTab === 'submit-application' && (
        <section className="card">
          <h2>Submit Application</h2>
          <form className="grid-form" onSubmit={handleApplicationSubmit}>
            <label>Applicant ID<input value={applicationForm.applicant_id} onChange={(event) => setApplicationForm({ ...applicationForm, applicant_id: event.target.value })} disabled={Boolean(authSession)} required /></label>
            <label>Application type<select value={applicationForm.application_type} onChange={(event) => setApplicationForm({ ...applicationForm, application_type: event.target.value as ApplicationType })}>{applicationTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label>Parcel number<input value={applicationForm.parcel_number} onChange={(event) => setApplicationForm({ ...applicationForm, parcel_number: event.target.value })} required /></label>
            <label>Block number<input value={applicationForm.block_number} onChange={(event) => setApplicationForm({ ...applicationForm, block_number: event.target.value })} required /></label>
            <label>Basin number<input value={applicationForm.basin_number} onChange={(event) => setApplicationForm({ ...applicationForm, basin_number: event.target.value })} required /></label>
            <label>Zone ID<input value={applicationForm.zone_id} onChange={(event) => setApplicationForm({ ...applicationForm, zone_id: event.target.value })} required /></label>
            <label className="full-width">Description<textarea value={applicationForm.description} onChange={(event) => setApplicationForm({ ...applicationForm, description: event.target.value })} rows={4} /></label>
            <button type="submit" disabled={loading}>Submit application</button>
          </form>
        </section>
      )}

      {activeTab === 'all-applications' && (
        <section className="card">
          <h2>All Applications</h2>
          <form className="grid-form" onSubmit={handleSharedApplicationsLookup}>
            <label>Applicant ID<input value={sharedApplicationFilters.applicant_id} onChange={(event) => setSharedApplicationFilters({ ...sharedApplicationFilters, applicant_id: event.target.value })} /></label>
            <label>Status<input placeholder="submitted" value={sharedApplicationFilters.status} onChange={(event) => setSharedApplicationFilters({ ...sharedApplicationFilters, status: event.target.value })} /></label>
            <label>Application type<select value={sharedApplicationFilters.application_type} onChange={(event) => setSharedApplicationFilters({ ...sharedApplicationFilters, application_type: event.target.value as '' | ApplicationType })}><option value="">all</option>{applicationTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label>Zone ID<input value={sharedApplicationFilters.zone_id} onChange={(event) => setSharedApplicationFilters({ ...sharedApplicationFilters, zone_id: event.target.value })} /></label>
            <button type="submit" disabled={loading}>Load applications</button>
          </form>
        </section>
      )}

      {activeTab === 'my-applications' && (
        <section className="card">
          <h2>My Applications</h2>
          <form className="inline-form" onSubmit={handleApplicationsLookup}>
            <label>Applicant ID<input value={lookupApplicantId} onChange={(event) => setLookupApplicantId(event.target.value)} disabled={Boolean(authSession)} required /></label>
            <button type="submit" disabled={loading}>Load applications</button>
          </form>
        </section>
      )}

      {activeTab === 'track-application' && (
        <section className="card">
          <h2>Track Application</h2>
          <form className="inline-form" onSubmit={handleTrackApplication}>
            <label>Application ID<input value={trackApplicationId} onChange={(event) => setTrackApplicationId(event.target.value)} required /></label>
            <button type="submit" disabled={loading}>Load application</button>
          </form>
        </section>
      )}

      {activeTab === 'upload-document' && (
        <section className="card">
          <h2>Upload Document Metadata</h2>
          <form className="grid-form" onSubmit={handleDocumentSubmit}>
            <label>Application ID<input value={documentForm.application_id} onChange={(event) => setDocumentForm({ ...documentForm, application_id: event.target.value })} required /></label>
            <label>Document type<input value={documentForm.document_type} onChange={(event) => setDocumentForm({ ...documentForm, document_type: event.target.value })} required /></label>
            <label>Filename<input value={documentForm.filename} onChange={(event) => setDocumentForm({ ...documentForm, filename: event.target.value })} required /></label>
            <label>Uploaded by applicant ID<input value={documentForm.uploaded_by_applicant_id} onChange={(event) => setDocumentForm({ ...documentForm, uploaded_by_applicant_id: event.target.value })} disabled={Boolean(authSession)} required /></label>
            <button type="submit" disabled={loading}>Save document metadata</button>
          </form>
        </section>
      )}

      {activeTab === 'add-comment' && (
        <section className="card">
          <h2>Add Comment</h2>
          <form className="grid-form" onSubmit={handleCommentSubmit}>
            <label>Application ID<input value={commentForm.application_id} onChange={(event) => setCommentForm({ ...commentForm, application_id: event.target.value })} required /></label>
            <label>Applicant ID<input value={commentForm.applicant_id} onChange={(event) => setCommentForm({ ...commentForm, applicant_id: event.target.value })} disabled={Boolean(authSession)} required /></label>
            <label className="full-width">Comment text<textarea value={commentForm.comment_text} onChange={(event) => setCommentForm({ ...commentForm, comment_text: event.target.value })} rows={4} required /></label>
            <button type="submit" disabled={loading}>Save comment</button>
          </form>
        </section>
      )}

      {activeTab === 'submit-objection' && (
        <section className="card">
          <h2>Submit Objection</h2>
          <form className="grid-form" onSubmit={handleObjectionSubmit}>
            <label>Application ID<input value={objectionForm.application_id} onChange={(event) => setObjectionForm({ ...objectionForm, application_id: event.target.value })} required /></label>
            <label>Applicant ID<input value={objectionForm.applicant_id} onChange={(event) => setObjectionForm({ ...objectionForm, applicant_id: event.target.value })} disabled={Boolean(authSession)} required /></label>
            <label className="full-width">Reason<textarea value={objectionForm.reason} onChange={(event) => setObjectionForm({ ...objectionForm, reason: event.target.value })} rows={4} required /></label>
            <label>Supporting document filename<input value={objectionForm.supporting_document_filename} onChange={(event) => setObjectionForm({ ...objectionForm, supporting_document_filename: event.target.value })} /></label>
            <button type="submit" disabled={loading}>Submit objection</button>
          </form>
        </section>
      )}

      {activeTab === 'timeline' && (
        <section className="card">
          <h2>Timeline</h2>
          <form className="inline-form" onSubmit={handleTimelineSubmit}>
            <label>Application ID<input value={timelineApplicationId} onChange={(event) => setTimelineApplicationId(event.target.value)} required /></label>
            <button type="submit" disabled={loading}>Load timeline</button>
          </form>
        </section>
      )}

      {activeTab === 'create-staff' && (
        <section className="card">
          <h2>Create Staff Member</h2>
          <p>Create surveyors and registrar staff. Staff endpoints use the <code>x-staff-token</code> header automatically.</p>
          <form className="grid-form" onSubmit={handleStaffSubmit}>
            <label>Staff code<input value={staffForm.staff_code} onChange={(event) => setStaffForm({ ...staffForm, staff_code: event.target.value })} required /></label>
            <label>Name<input value={staffForm.name} onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })} required /></label>
            <label>Role<select value={staffForm.role} onChange={(event) => setStaffForm({ ...staffForm, role: event.target.value as StaffRole })}>{staffRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
            <label>Department<input value={staffForm.department} onChange={(event) => setStaffForm({ ...staffForm, department: event.target.value })} /></label>
            <label className="full-width">Skills, comma separated<input value={staffForm.skills} onChange={(event) => setStaffForm({ ...staffForm, skills: event.target.value })} /></label>
            <label className="full-width">Coverage zones, comma separated<input value={staffForm.zone_ids} onChange={(event) => setStaffForm({ ...staffForm, zone_ids: event.target.value })} /></label>
            <label>Max active tasks<input type="number" min="1" value={staffForm.max_tasks} onChange={(event) => setStaffForm({ ...staffForm, max_tasks: event.target.value })} /></label>
            <label>Phone<input value={staffForm.phone} onChange={(event) => setStaffForm({ ...staffForm, phone: event.target.value })} /></label>
            <label>Email<input type="email" value={staffForm.email} onChange={(event) => setStaffForm({ ...staffForm, email: event.target.value })} /></label>
            <button type="submit" disabled={loading}>Create staff</button>
          </form>
        </section>
      )}

      {activeTab === 'staff-list' && (
        <section className="card">
          <h2>Staff List</h2>
          <form className="inline-form" onSubmit={handleStaffList}>
            <label>Role<select value={staffListFilters.role} onChange={(event) => setStaffListFilters({ ...staffListFilters, role: event.target.value as '' | StaffRole })}><option value="">all</option>{staffRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
            <label>Active<select value={staffListFilters.active} onChange={(event) => setStaffListFilters({ ...staffListFilters, active: event.target.value })}><option value="">all</option><option value="true">true</option><option value="false">false</option></select></label>
            <button type="submit" disabled={loading}>Load staff</button>
          </form>
        </section>
      )}

      {activeTab === 'staff-detail' && (
        <section className="card">
          <h2>Staff Detail</h2>
          <form className="inline-form" onSubmit={handleStaffDetail}>
            <label>Staff ID<input value={staffDetailId} onChange={(event) => setStaffDetailId(event.target.value)} required /></label>
            <button type="submit" disabled={loading}>Load staff profile</button>
          </form>
        </section>
      )}

      {activeTab === 'auto-assign' && (
        <section className="card">
          <h2>Auto Assign Surveyor</h2>
          <p>Needs an existing application ID and at least one active surveyor in the same zone with the required skill.</p>
          <form className="grid-form" onSubmit={handleAutoAssign}>
            <label>Application ID<input value={assignForm.application_id} onChange={(event) => setAssignForm({ ...assignForm, application_id: event.target.value })} required /></label>
            <label>Required skill<input value={assignForm.required_skill} onChange={(event) => setAssignForm({ ...assignForm, required_skill: event.target.value })} /></label>
            <label>Priority<select value={assignForm.priority} onChange={(event) => setAssignForm({ ...assignForm, priority: event.target.value as 'low' | 'normal' | 'high' | 'urgent' })}><option value="low">low</option><option value="normal">normal</option><option value="high">high</option><option value="urgent">urgent</option></select></label>
            <button type="submit" disabled={loading}>Auto assign</button>
          </form>
        </section>
      )}

      {activeTab === 'survey-tasks' && (
        <section className="card">
          <h2>Survey Tasks</h2>
          <form className="grid-form" onSubmit={handleTaskList}>
            <label>Surveyor ID<input value={taskFilters.surveyor_id} onChange={(event) => setTaskFilters({ ...taskFilters, surveyor_id: event.target.value })} /></label>
            <label>Application ID<input value={taskFilters.application_id} onChange={(event) => setTaskFilters({ ...taskFilters, application_id: event.target.value })} /></label>
            <label>Status<input placeholder="assigned" value={taskFilters.status} onChange={(event) => setTaskFilters({ ...taskFilters, status: event.target.value })} /></label>
            <button type="submit" disabled={loading}>Load survey tasks</button>
          </form>
        </section>
      )}

      {activeTab === 'survey-milestone' && (
        <section className="card">
          <h2>Survey Milestone</h2>
          <p>Milestones must be done in order: visit scheduled → arrived on site → survey started → survey completed.</p>
          <form className="grid-form" onSubmit={handleMilestoneSubmit}>
            <label>Application ID<input value={milestoneForm.application_id} onChange={(event) => setMilestoneForm({ ...milestoneForm, application_id: event.target.value })} required /></label>
            <label>Assigned surveyor staff ID<input value={milestoneForm.by_staff_id} onChange={(event) => setMilestoneForm({ ...milestoneForm, by_staff_id: event.target.value })} required /></label>
            <label>Milestone<select value={milestoneForm.milestone} onChange={(event) => setMilestoneForm({ ...milestoneForm, milestone: event.target.value as SurveyMilestone })}>{milestones.map((milestone) => <option key={milestone} value={milestone}>{milestone}</option>)}</select></label>
            <label>Scheduled visit date<input type="date" value={milestoneForm.scheduled_visit_date} onChange={(event) => setMilestoneForm({ ...milestoneForm, scheduled_visit_date: event.target.value })} /></label>
            <label className="full-width">Notes<textarea value={milestoneForm.notes} onChange={(event) => setMilestoneForm({ ...milestoneForm, notes: event.target.value })} rows={4} /></label>
            <button type="submit" disabled={loading}>Save milestone</button>
          </form>
        </section>
      )}

      {activeTab === 'survey-report' && (
        <section className="card">
          <h2>Survey Report Metadata</h2>
          <p>Allowed only after the task reaches <code>survey_completed</code>.</p>
          <form className="grid-form" onSubmit={handleReportSubmit}>
            <label>Application ID<input value={reportForm.application_id} onChange={(event) => setReportForm({ ...reportForm, application_id: event.target.value })} required /></label>
            <label>Uploaded by surveyor staff ID<input value={reportForm.uploaded_by_staff_id} onChange={(event) => setReportForm({ ...reportForm, uploaded_by_staff_id: event.target.value })} required /></label>
            <label>Report title<input value={reportForm.report_title} onChange={(event) => setReportForm({ ...reportForm, report_title: event.target.value })} required /></label>
            <label>File name<input value={reportForm.file_name} onChange={(event) => setReportForm({ ...reportForm, file_name: event.target.value })} /></label>
            <label className="full-width">File URL<input value={reportForm.file_url} onChange={(event) => setReportForm({ ...reportForm, file_url: event.target.value })} /></label>
            <label className="full-width">Summary<textarea value={reportForm.summary} onChange={(event) => setReportForm({ ...reportForm, summary: event.target.value })} rows={4} /></label>
            <label className="full-width">Findings<textarea value={reportForm.findings} onChange={(event) => setReportForm({ ...reportForm, findings: event.target.value })} rows={4} /></label>
            <button type="submit" disabled={loading}>Upload report metadata</button>
          </form>
        </section>
      )}

      {activeTab === 'registrar-review' && (
        <section className="card">
          <h2>Registrar Review</h2>
          <p>Allowed only after a survey report is uploaded. Accepted reports move the application to legal_review.</p>
          <form className="grid-form" onSubmit={handleRegistrarReview}>
            <label>Application ID<input value={reviewForm.application_id} onChange={(event) => setReviewForm({ ...reviewForm, application_id: event.target.value })} required /></label>
            <label>Registrar staff ID<input value={reviewForm.registrar_staff_id} onChange={(event) => setReviewForm({ ...reviewForm, registrar_staff_id: event.target.value })} required /></label>
            <label>Decision<select value={reviewForm.decision} onChange={(event) => setReviewForm({ ...reviewForm, decision: event.target.value as RegistrarDecision })}>{registrarDecisions.map((decision) => <option key={decision} value={decision}>{decision}</option>)}</select></label>
            <label className="full-width">Notes<textarea value={reviewForm.notes} onChange={(event) => setReviewForm({ ...reviewForm, notes: event.target.value })} rows={4} /></label>
            <button type="submit" disabled={loading}>Save registrar review</button>
          </form>
        </section>
      )}

      {activeTab === 'analytics-map' && <AnalyticsPage />}

      {statusMessage && <p className="status">{loading ? `${statusMessage}` : statusMessage}</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}
      <JsonBlock title={resultTitle} value={result} />
        </div>
      </main>
    </div>
  );
}

export default App;
