import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Check, ChevronLeft, ChevronRight, Filter, Lock, Mail, MapPin, MoreVertical, Plus, Search, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import LocationAutocompleteInput from '../components/LocationAutocompleteInput';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import apiService from '../services/api';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  ConfirmationDialog,
  DropdownMenu,
  Drawer,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Skeleton,
  Textarea,
} from '../components/ui';

const CATEGORY_OPTIONS = [
  { value: 'COLLEGE', label: 'College / University' },
  { value: 'HOSPITAL', label: 'Hospital / Clinic' },
  { value: 'RESIDENTIAL', label: 'Residential Society' },
  { value: 'CORPORATE', label: 'Corporate / Office' },
  { value: 'OTHER', label: 'Other Organization' },
];

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', help: 'Visible to people nearby. Anyone can preview the community.' },
  { value: 'PRIVATE', label: 'Private', help: 'Visible with limited details. Membership is controlled by admins.' },
  { value: 'RESTRICTED', label: 'Restricted', help: 'Only eligible people can see or join sensitive community spaces.' },
];

const JOIN_POLICY_OPTIONS = [
  { value: 'OPEN', label: 'Open', help: 'People can join directly when they are eligible.' },
  { value: 'JOIN_CODE', label: 'Join code', help: 'Members enter a code provided by the community team.' },
  { value: 'EMAIL_DOMAIN', label: 'Email domain', help: 'Eligible members verify with an approved email domain.' },
  { value: 'APPROVAL_REQUIRED', label: 'Approval required', help: 'Admins review each join request before access.' },
  { value: 'INVITE_ONLY', label: 'Invite only', help: 'Only invited members can join.' },
];

const DEFAULT_FORM = {
  name: '',
  type: 'COLLEGE',
  category: 'COLLEGE',
  visibility: 'PUBLIC',
  joinPolicy: 'OPEN',
  description: '',
  address: '',
  city: '',
  district: '',
  state: '',
  verificationCode: '',
  emailDomain: '',
};

function cleanError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  if (/exception|java\.|stack|trace/i.test(message)) return fallback;
  return message;
}

function readable(value, fallback = 'Not specified') {
  if (!value) return fallback;
  return String(value).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function memberState(community, joinedIds) {
  const role = community.currentUserRole || community.role;
  const status = community.membershipStatus || community.currentUserMembershipStatus;
  if (role || status === 'ACTIVE' || joinedIds.includes(community.id)) {
    return { label: role ? readable(role) : 'Member', tone: 'success', joined: true };
  }
  if (status === 'PENDING') return { label: 'Pending approval', tone: 'warning', pending: true };
  if (status === 'REJECTED') return { label: 'Request rejected', tone: 'danger' };
  if (status === 'BLOCKED' || status === 'INELIGIBLE') return { label: 'Not eligible', tone: 'danger', blocked: true };
  return { label: 'Not joined', tone: 'default' };
}

function canAttemptJoin(community, state) {
  const policy = String(community.joinPolicy || 'OPEN').toUpperCase();
  if (state.joined || state.pending || state.blocked) return false;
  return policy !== 'INVITE_ONLY';
}

function CommunityCard({ community, joinedIds, onJoin, onLeave, onArchive }) {
  const state = memberState(community, joinedIds);
  const role = String(community.currentUserRole || community.role || '').toUpperCase();
  const isOwner = role === 'OWNER';
  const visibility = String(community.visibility || 'PUBLIC').toUpperCase();
  const policy = String(community.joinPolicy || 'OPEN').toUpperCase();
  const location = [community.city, community.state].filter(Boolean).join(', ') || community.location || community.address || 'Location shared by community';

  return (
    <Card className={`p7b-community-card p7b-community-card--${visibility.toLowerCase()}`}>
      <div className="p7b-card-top">
        <Avatar name={community.name} src={community.imageUrl || community.avatarUrl} size="lg" />
        <div className="p7b-card-badges">
          <Badge variant={visibility === 'PUBLIC' ? 'success' : visibility === 'PRIVATE' ? 'warning' : 'info'}>{readable(visibility)}</Badge>
          <Badge variant="default">{readable(policy)}</Badge>
        </div>
      </div>
      <div>
        <h2>{community.name}</h2>
        <p>{community.description || 'A verified local space for coordinated help and trusted updates.'}</p>
      </div>
      <div className="p7b-card-meta">
        <span><MapPin size={16} aria-hidden="true" />{location}</span>
        <span><Users size={16} aria-hidden="true" />{community.memberCount ?? 0} members</span>
        <span><Building2 size={16} aria-hidden="true" />{readable(community.category || community.type || 'Community')}</span>
      </div>
      <div className="p7b-card-footer">
        <Badge variant={state.tone}>{state.label}</Badge>
        <div className="p7b-card-actions">
          {isOwner ? (
            <>
              <Button to={`/community/${community.id}`} variant="secondary" size="sm">View</Button>
              <Button to={`/community/${community.id}/manage`} size="sm">Manage</Button>
              <DropdownMenu label={<MoreVertical size={16} />}>
                <Button type="button" variant="danger" size="sm" onClick={() => onArchive(community)}><Trash2 size={14} />Archive</Button>
              </DropdownMenu>
            </>
          ) : state.joined ? (
            <>
              <Button to={`/community/${community.id}`} variant="secondary" size="sm">View</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onLeave(community)}>Leave</Button>
            </>
          ) : (
            <>
              <Button to={`/community/${community.id}`} variant="secondary" size="sm">View</Button>
              {canAttemptJoin(community, state) && <Button type="button" size="sm" onClick={() => onJoin(community)}>Join</Button>}
              {state.pending && <Button type="button" variant="secondary" size="sm" disabled>Pending</Button>}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function FilterFields({ filters, setFilters }) {
  const update = (name, value) => setFilters((current) => ({ ...current, [name]: value }));
  return (
    <div className="p7b-filter-grid">
      <FormField label="Category">
        <Select value={filters.category} onChange={(event) => update('category', event.target.value)}>
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      </FormField>
      <FormField label="Visibility">
        <Select value={filters.visibility} onChange={(event) => update('visibility', event.target.value)}>
          <option value="">Any visibility</option>
          {VISIBILITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      </FormField>
      <FormField label="Join policy">
        <Select value={filters.joinPolicy} onChange={(event) => update('joinPolicy', event.target.value)}>
          <option value="">Any policy</option>
          {JOIN_POLICY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      </FormField>
      <FormField label="City">
        <Input value={filters.city} onChange={(event) => update('city', event.target.value)} placeholder="City" />
      </FormField>
      <FormField label="District">
        <Input value={filters.district} onChange={(event) => update('district', event.target.value)} placeholder="District" />
      </FormField>
      <FormField label="State">
        <Input value={filters.state} onChange={(event) => update('state', event.target.value)} placeholder="State" />
      </FormField>
    </div>
  );
}

function CreateCommunityModal({ open, onClose, onCreated }) {
  const { user } = useAuth();
  const { showToast, notifyCommunityCreated } = useNotifications();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const steps = ['Identity', 'Location', 'Access', 'Join policy', 'Review'];

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setForm(DEFAULT_FORM);
    setErrors({});
    setSubmitError('');
  }, [open]);

  const update = (name, value) => {
    setSubmitError('');
    setErrors((current) => ({ ...current, [name]: undefined }));
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'type') next.category = value;
      if (name === 'joinPolicy' && value !== 'JOIN_CODE') next.verificationCode = '';
      if (name === 'joinPolicy' && value !== 'EMAIL_DOMAIN') next.emailDomain = '';
      return next;
    });
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Community name is required.';
    if (!form.description.trim()) next.description = 'Add a short purpose so people know where they are joining.';
    if (!form.address.trim() && !form.city.trim()) next.address = 'Add a location, city, or address.';
    if (form.joinPolicy === 'JOIN_CODE' && !form.verificationCode.trim()) next.verificationCode = 'Join-code communities need a code.';
    if (form.joinPolicy === 'EMAIL_DOMAIN' && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(form.emailDomain.trim())) {
      next.emailDomain = 'Enter a valid domain, for example college.edu.';
    }
    setErrors(next);
    const firstInvalidStep = next.name || next.description ? 0
      : next.address ? 1
        : next.verificationCode || next.emailDomain ? 3
          : null;
    if (firstInvalidStep !== null) {
      setStep(firstInvalidStep);
      setSubmitError('Please complete the highlighted fields.');
      return false;
    }
    setSubmitError('');
    return true;
  };

  const submit = async () => {
    if (!validate() || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        ...form,
        verificationCode: form.joinPolicy === 'JOIN_CODE' ? form.verificationCode.trim() : '',
        emailDomain: form.joinPolicy === 'EMAIL_DOMAIN' ? form.emailDomain.trim().toLowerCase() : '',
      };
      const response = await apiService.createCommunity(payload, user?.userId || user?.id);
      const created = response.data;
      showToast?.({ message: `${created.name} is ready.`, type: 'success' });
      notifyCommunityCreated?.(created.name);
      onCreated(created);
      onClose();
      navigate(`/community/${created.id}`);
    } catch (error) {
      const message = cleanError(error, 'Community could not be created.');
      setSubmitError(message);
      showToast?.({ message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === steps.length - 1) submit();
    else setStep((current) => Math.min(steps.length - 1, current + 1));
  };

  return (
    <Modal
      open={open}
      title="Create community"
      onClose={onClose}
      footer={(
        <>
          <Button type="button" variant="secondary" onClick={step === 0 ? onClose : () => setStep((current) => current - 1)}>
            {step === 0 ? 'Cancel' : <><ChevronLeft size={16} />Back</>}
          </Button>
          <Button type="button" loading={submitting} onClick={nextStep}>
            {step === steps.length - 1 ? 'Create community' : <>Next<ChevronRight size={16} /></>}
          </Button>
        </>
      )}
    >
      <div className="p7b-create">
        <div className="p7b-stepper" aria-label="Create community steps">
          {steps.map((label, index) => (
            <button key={label} type="button" className={index === step ? 'is-active' : index < step ? 'is-done' : ''} onClick={() => setStep(index)}>
              <span>{index + 1}</span>{label}
            </button>
          ))}
        </div>

        {submitError && <Alert variant="danger" title="Create community">{submitError}</Alert>}

        {step === 0 && (
          <div className="p7b-form-section">
            <FormField label="Community name" error={errors.name}>
              <Input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Green Valley Residents" maxLength={100} />
            </FormField>
            <FormField label="Community type">
              <Select value={form.type} onChange={(event) => update('type', event.target.value)}>
                {CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Purpose" error={errors.description}>
              <Textarea value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe who this community helps and how members coordinate." rows={4} maxLength={600} />
            </FormField>
          </div>
        )}

        {step === 1 && (
          <div className="p7b-form-section">
            <FormField label="Address or area" error={errors.address}>
              <LocationAutocompleteInput value={form.address} onValueChange={(value) => update('address', value)} placeholder="Area, address, or landmark" />
            </FormField>
            <div className="p7b-two-col">
              <FormField label="City"><Input value={form.city} onChange={(event) => update('city', event.target.value)} /></FormField>
              <FormField label="District"><Input value={form.district} onChange={(event) => update('district', event.target.value)} /></FormField>
              <FormField label="State"><Input value={form.state} onChange={(event) => update('state', event.target.value)} /></FormField>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p7b-choice-list">
            {VISIBILITY_OPTIONS.map((item) => (
              <button key={item.value} type="button" className={form.visibility === item.value ? 'is-selected' : ''} onClick={() => update('visibility', item.value)}>
                <ShieldCheck size={20} aria-hidden="true" />
                <span><strong>{item.label}</strong><small>{item.help}</small></span>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="p7b-form-section">
            <div className="p7b-choice-list">
              {JOIN_POLICY_OPTIONS.map((item) => (
                <button key={item.value} type="button" className={form.joinPolicy === item.value ? 'is-selected' : ''} onClick={() => update('joinPolicy', item.value)}>
                  {item.value === 'EMAIL_DOMAIN' ? <Mail size={20} /> : item.value === 'INVITE_ONLY' ? <Lock size={20} /> : <Users size={20} />}
                  <span><strong>{item.label}</strong><small>{item.help}</small></span>
                </button>
              ))}
            </div>
            {form.joinPolicy === 'JOIN_CODE' && (
              <FormField label="Join code" error={errors.verificationCode} hint="This is submitted only for join-code communities.">
                <Input value={form.verificationCode} onChange={(event) => update('verificationCode', event.target.value.toUpperCase())} placeholder="COMMUNITY2026" />
              </FormField>
            )}
            {form.joinPolicy === 'EMAIL_DOMAIN' && (
              <FormField label="Allowed email domain" error={errors.emailDomain}>
                <Input value={form.emailDomain} onChange={(event) => update('emailDomain', event.target.value.toLowerCase())} placeholder="example.edu" />
              </FormField>
            )}
            {form.joinPolicy === 'APPROVAL_REQUIRED' && <Alert title="Admin review">Join requests will remain pending until an owner or admin approves them.</Alert>}
            {form.joinPolicy === 'INVITE_ONLY' && <Alert title="Invitation required">The frontend will not show a public join action for invite-only communities.</Alert>}
          </div>
        )}

        {step === 4 && (
          <div className="p7b-review">
            <div><span>Name</span><strong>{form.name || 'Not set'}</strong></div>
            <div><span>Type</span><strong>{readable(form.type)}</strong></div>
            <div><span>Location</span><strong>{[form.city, form.state].filter(Boolean).join(', ') || form.address || 'Not set'}</strong></div>
            <div><span>Visibility</span><strong>{readable(form.visibility)}</strong></div>
            <div><span>Join policy</span><strong>{readable(form.joinPolicy)}</strong></div>
            {form.joinPolicy === 'EMAIL_DOMAIN' && <div><span>Domain</span><strong>{form.emailDomain || 'Not set'}</strong></div>}
            {form.joinPolicy === 'JOIN_CODE' && <div><span>Code</span><strong>{form.verificationCode ? 'Configured' : 'Not set'}</strong></div>}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Communities() {
  const { user } = useAuth();
  const { showToast, notifyCommunityJoined } = useNotifications();
  const [communities, setCommunities] = useState([]);
  const [joinedIds, setJoinedIds] = useState([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filters, setFilters] = useState({ category: '', visibility: '', joinPolicy: '', city: '', district: '', state: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [joinTarget, setJoinTarget] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const activeFilters = useMemo(() => Object.entries({ query: debouncedQuery, ...filters }).filter(([, value]) => String(value || '').trim()), [debouncedQuery, filters]);

  const loadCommunities = async () => {
    setLoading(true);
    setError('');
    try {
      const params = Object.fromEntries(activeFilters);
      const [communityRes, joinedRes] = await Promise.all([
        apiService.getCommunities(params),
        apiService.getJoinedCommunities(user?.userId || user?.id).catch(() => ({ data: [] })),
      ]);
      const rows = Array.isArray(communityRes.data) ? communityRes.data : (communityRes.data?.content || []);
      const joinedRows = Array.isArray(joinedRes.data) ? joinedRes.data : [];
      const backendJoinedIds = joinedRows.map((item) => item.id);
      const inferredIds = rows.filter((item) => memberState(item, []).joined).map((item) => item.id);
      setCommunities(rows);
      setJoinedIds(Array.from(new Set([...backendJoinedIds, ...inferredIds])));
    } catch (loadError) {
      setCommunities([]);
      setError(cleanError(loadError, 'Unable to load communities right now.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommunities();
  }, [debouncedQuery, filters.category, filters.visibility, filters.joinPolicy, filters.city, filters.district, filters.state]);

  const clearFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setFilters({ category: '', visibility: '', joinPolicy: '', city: '', district: '', state: '' });
  };

  const openJoin = (community) => {
    setJoinTarget(community);
    setJoinCode('');
  };

  const joinCommunity = async (event) => {
    event.preventDefault();
    if (!joinTarget || joining) return;
    const policy = String(joinTarget.joinPolicy || 'OPEN').toUpperCase();
    if (policy === 'JOIN_CODE' && !joinCode.trim()) return;
    setJoining(true);
    try {
      const response = await apiService.joinCommunity(joinTarget.id, policy === 'JOIN_CODE' ? joinCode.trim() : undefined, user?.userId || user?.id);
      const pending = response.data?.status === 'PENDING';
      setCommunities((current) => current.map((community) => community.id === joinTarget.id
        ? {
          ...community,
          membershipStatus: pending ? 'PENDING' : 'ACTIVE',
          memberCount: pending ? community.memberCount : (community.memberCount ?? 0) + 1,
        }
        : community));
      if (!pending) setJoinedIds((current) => Array.from(new Set([...current, joinTarget.id])));
      notifyCommunityJoined?.(joinTarget.name);
      showToast?.({ message: pending ? 'Join request sent for admin review.' : `Joined ${joinTarget.name}.`, type: 'success' });
      setJoinTarget(null);
    } catch (joinError) {
      showToast?.({ message: cleanError(joinError, 'Unable to join this community.'), type: 'error' });
    } finally {
      setJoining(false);
    }
  };

  const leaveCommunity = async (community) => {
    try {
      await apiService.leaveCommunity(community.id, user?.userId || user?.id);
      setJoinedIds((current) => current.filter((id) => id !== community.id));
      setCommunities((current) => current.map((item) => item.id === community.id
        ? { ...item, currentUserRole: null, membershipStatus: null, memberCount: Math.max(0, (item.memberCount ?? 1) - 1) }
        : item));
      showToast?.({ message: `Left ${community.name}.`, type: 'success' });
    } catch (leaveError) {
      showToast?.({ message: cleanError(leaveError, 'Unable to leave this community.'), type: 'error' });
    }
  };

  const archiveCommunity = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await apiService.deleteCommunity(archiveTarget.id);
      setCommunities((current) => current.filter((community) => community.id !== archiveTarget.id));
      showToast?.({ message: `${archiveTarget.name} archived.`, type: 'success' });
      setArchiveTarget(null);
    } catch (archiveError) {
      showToast?.({ message: cleanError(archiveError, 'Unable to archive this community.'), type: 'error' });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="p7b-communities animate-in">
      <PageHeader
        eyebrow="Neighborhood spaces"
        title="Communities"
        description="Find verified local groups, join the right space, and coordinate requests, discussions, campaigns, and announcements with people nearby."
        action={<Button type="button" onClick={() => setCreateOpen(true)}><Plus size={17} />Create Community</Button>}
      />

      <section className="p7b-discovery-panel" aria-label="Community discovery controls">
        <div className="p7b-search-row">
          <SearchInput aria-label="Search communities" placeholder="Search by name, purpose, or location" value={query} onChange={(event) => setQuery(event.target.value)} />
          {query && <Button type="button" variant="ghost" onClick={() => setQuery('')}><X size={16} />Clear</Button>}
          <Button type="button" variant="secondary" className="p7b-mobile-filter" onClick={() => setFilterOpen(true)}><Filter size={16} />Filters</Button>
        </div>
        <div className="p7b-desktop-filters">
          <FilterFields filters={filters} setFilters={setFilters} />
        </div>
        {activeFilters.length > 0 && (
          <div className="p7b-active-chips" aria-label="Active filters">
            {activeFilters.map(([key, value]) => <Badge key={key} variant="info">{readable(key)}: {value}</Badge>)}
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Clear all</Button>
          </div>
        )}
      </section>

      <div className="p7b-summary-line">
        <span><Check size={16} aria-hidden="true" />{joinedIds.length} joined</span>
        <span><Search size={16} aria-hidden="true" />{loading ? 'Searching...' : `${communities.length} communities shown`}</span>
      </div>

      {error && <ErrorState title="Communities could not load" message={error} onRetry={loadCommunities} />}
      {!error && loading && (
        <div className="p7b-community-grid" aria-label="Loading communities">
          {Array.from({ length: 6 }).map((_, index) => <Card key={index} className="p7b-community-card"><Skeleton lines={5} /></Card>)}
        </div>
      )}
      {!error && !loading && communities.length === 0 && (
        <EmptyState
          title="No communities found"
          message={activeFilters.length ? 'Try clearing filters or searching another location.' : 'Create the first verified local community for your area.'}
          actionLabel={activeFilters.length ? 'Clear filters' : 'Create community'}
          onAction={activeFilters.length ? clearFilters : () => setCreateOpen(true)}
        />
      )}
      {!error && !loading && communities.length > 0 && (
        <div className="p7b-community-grid">
          {communities.map((community) => (
            <CommunityCard key={community.id} community={community} joinedIds={joinedIds} onJoin={openJoin} onLeave={leaveCommunity} onArchive={setArchiveTarget} />
          ))}
        </div>
      )}

      <Drawer open={filterOpen} title="Community filters" onClose={() => setFilterOpen(false)}>
        <FilterFields filters={filters} setFilters={setFilters} />
        <div className="p7b-drawer-actions">
          <Button type="button" variant="secondary" onClick={clearFilters}>Clear filters</Button>
          <Button type="button" onClick={() => setFilterOpen(false)}>Show results</Button>
        </div>
      </Drawer>

      <Modal
        open={Boolean(joinTarget)}
        title={joinTarget ? `Join ${joinTarget.name}` : 'Join community'}
        onClose={() => setJoinTarget(null)}
        footer={(
          <>
            <Button type="button" variant="secondary" onClick={() => setJoinTarget(null)}>Cancel</Button>
            <Button type="button" loading={joining} onClick={joinCommunity}>Join community</Button>
          </>
        )}
      >
        {joinTarget && (
          <form className="p7b-form-section" onSubmit={joinCommunity}>
            <Alert title={readable(joinTarget.joinPolicy || 'OPEN')}>
              {String(joinTarget.joinPolicy || 'OPEN').toUpperCase() === 'JOIN_CODE'
                ? 'Enter the code shared by a community owner or admin.'
                : String(joinTarget.joinPolicy || 'OPEN').toUpperCase() === 'EMAIL_DOMAIN'
                  ? 'Sahay will verify your eligibility for this email-domain community.'
                  : String(joinTarget.joinPolicy || 'OPEN').toUpperCase() === 'APPROVAL_REQUIRED'
                    ? 'Your request may stay pending until an admin approves it.'
                    : 'This community accepts direct join requests when you are eligible.'}
            </Alert>
            {String(joinTarget.joinPolicy || 'OPEN').toUpperCase() === 'JOIN_CODE' && (
              <FormField label="Join code">
                <Input type="password" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} autoFocus autoComplete="off" />
              </FormField>
            )}
          </form>
        )}
      </Modal>

      <CreateCommunityModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          setCommunities((current) => [created, ...current]);
          setJoinedIds((current) => Array.from(new Set([...current, created.id])));
        }}
      />
      <ConfirmationDialog
        open={Boolean(archiveTarget)}
        title="Archive community?"
        message={`Archive ${archiveTarget?.name || 'this community'}? It will leave discovery and stop new joins while preserving existing history.`}
        confirmLabel="Archive community"
        destructive
        loading={archiving}
        onClose={() => setArchiveTarget(null)}
        onConfirm={archiveCommunity}
      />
    </div>
  );
}
