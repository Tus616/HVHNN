import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Megaphone, Save, ShieldCheck, Trash2, Users } from 'lucide-react';
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
  EmptyState,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  RoleBadge,
  Select,
  Skeleton,
  Tabs,
  Textarea,
} from '../components/ui';

const CATEGORY_OPTIONS = ['COLLEGE', 'HOSPITAL', 'RESIDENTIAL', 'CORPORATE', 'OTHER'];
const VISIBILITY_OPTIONS = ['PUBLIC', 'PRIVATE', 'RESTRICTED'];
const JOIN_POLICY_OPTIONS = ['OPEN', 'JOIN_CODE', 'EMAIL_DOMAIN', 'APPROVAL_REQUIRED', 'INVITE_ONLY'];
const ROLE_OPTIONS = ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'];

function cleanError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  if (/exception|java\.|stack|trace/i.test(message)) return fallback;
  return message;
}

function readable(value) {
  return String(value || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function canManageRole(currentRole, targetRole) {
  const current = String(currentRole || '').toUpperCase();
  const target = String(targetRole || '').toUpperCase();
  if (target === 'OWNER') return false;
  return ['OWNER', 'ADMIN'].includes(current);
}

export default function CommunityManage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useNotifications();
  const [community, setCommunity] = useState(null);
  const [members, setMembers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [form, setForm] = useState({ name: '', type: 'COLLEGE', category: 'COLLEGE', description: '', address: '', city: '', district: '', state: '', visibility: 'PUBLIC', joinPolicy: 'OPEN', verificationCode: '', emailDomain: '' });
  const [broadcast, setBroadcast] = useState({ title: '', message: '', urgency: 'MEDIUM' });
  const [announcement, setAnnouncement] = useState({ title: '', body: '' });
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [confirm, setConfirm] = useState(null);
  const loadSeq = useRef(0);

  const currentRole = community?.currentUserRole || user?.role;
  const owner = String(currentRole || '').toUpperCase() === 'OWNER' || user?.isAdmin;
  const admin = ['OWNER', 'ADMIN'].includes(String(currentRole || '').toUpperCase()) || user?.isAdmin;

  const load = async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError('');
    try {
      const [detailRes, memberRes, announcementRes] = await Promise.all([
        apiService.getCommunityDetail(id),
        apiService.getCommunityMembers(id).catch(() => ({ data: [] })),
        apiService.getAnnouncements(id).catch(() => ({ data: [] })),
      ]);
      if (seq !== loadSeq.current) return;
      const detail = detailRes.data?.community || detailRes.data;
      setCommunity(detail);
      setMembers(memberRes.data || []);
      setAnnouncements(announcementRes.data || []);
      setForm({
        name: detail?.name || '',
        type: detail?.type || detail?.category || 'COLLEGE',
        category: detail?.category || detail?.type || 'COLLEGE',
        description: detail?.description || '',
        address: detail?.address || detail?.location || '',
        city: detail?.city || '',
        district: detail?.district || '',
        state: detail?.state || '',
        visibility: detail?.visibility || 'PUBLIC',
        joinPolicy: detail?.joinPolicy || 'OPEN',
        verificationCode: '',
        emailDomain: detail?.emailDomain || '',
      });
    } catch (loadError) {
      if (seq === loadSeq.current) setError(cleanError(loadError, 'Community management could not load.'));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    setActiveTab('general');
    load();
  }, [id]);

  const visibleMembers = useMemo(() => members.filter((member) => String(member.status || 'ACTIVE').toUpperCase() !== 'REMOVED'), [members]);

  const updateForm = (name, value) => {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'type') next.category = value;
      if (name === 'joinPolicy' && value !== 'JOIN_CODE') next.verificationCode = '';
      if (name === 'joinPolicy' && value !== 'EMAIL_DOMAIN') next.emailDomain = '';
      return next;
    });
  };

  const saveSettings = async (event) => {
    event?.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      showToast?.({ message: 'Name and location are required.', type: 'error' });
      return;
    }
    setSaving('settings');
    try {
      const payload = {
        ...form,
        verificationCode: form.joinPolicy === 'JOIN_CODE' ? form.verificationCode : '',
        emailDomain: form.joinPolicy === 'EMAIL_DOMAIN' ? form.emailDomain : '',
      };
      const response = await apiService.updateCommunity(id, payload);
      setCommunity(response.data || community);
      showToast?.({ message: 'Community settings updated.', type: 'success' });
      await load();
    } catch (saveError) {
      showToast?.({ message: cleanError(saveError, 'Unable to save settings.'), type: 'error' });
    } finally {
      setSaving('');
    }
  };

  const changeRole = async (member, role) => {
    setSaving(`role-${member.id}`);
    try {
      await apiService.updateCommunityMemberRole(id, member.id || member.userId, role);
      showToast?.({ message: `${member.fullName || 'Member'} role updated.`, type: 'success' });
      await load();
    } catch (roleError) {
      showToast?.({ message: cleanError(roleError, 'Unable to update this role.'), type: 'error' });
    } finally {
      setSaving('');
    }
  };

  const removeMember = async (member) => {
    setSaving(`remove-${member.id}`);
    try {
      await apiService.removeCommunityMember(id, member.id || member.userId);
      showToast?.({ message: `${member.fullName || 'Member'} removed.`, type: 'success' });
      await load();
    } catch (removeError) {
      showToast?.({ message: cleanError(removeError, 'Unable to remove this member.'), type: 'error' });
    } finally {
      setSaving('');
      setConfirm(null);
    }
  };

  const sendBroadcast = async (event) => {
    event.preventDefault();
    if (!broadcast.title.trim() || !broadcast.message.trim()) return;
    setSaving('broadcast');
    try {
      await apiService.broadcastCommunityMessage(id, { title: broadcast.title, content: broadcast.message, urgency: broadcast.urgency });
      showToast?.({ message: 'Broadcast sent to community members.', type: 'success' });
      setBroadcast({ title: '', message: '', urgency: 'MEDIUM' });
    } catch (broadcastError) {
      showToast?.({ message: cleanError(broadcastError, 'Unable to send broadcast.'), type: 'error' });
    } finally {
      setSaving('');
    }
  };

  const postAnnouncement = async (event) => {
    event.preventDefault();
    if (!announcement.title.trim() || !announcement.body.trim()) return;
    setSaving('announcement');
    try {
      await apiService.createAnnouncement(id, announcement);
      showToast?.({ message: 'Announcement posted.', type: 'success' });
      setAnnouncement({ title: '', body: '' });
      await load();
    } catch (announcementError) {
      showToast?.({ message: cleanError(announcementError, 'Unable to post announcement.'), type: 'error' });
    } finally {
      setSaving('');
    }
  };

  const deleteCommunity = async () => {
    setSaving('delete');
    try {
      await apiService.deleteCommunity(id);
      showToast?.({ message: 'Community deleted.', type: 'success' });
      navigate('/communities');
    } catch (deleteError) {
      showToast?.({ message: cleanError(deleteError, 'Unable to delete this community.'), type: 'error' });
      setSaving('');
      setConfirm(null);
    }
  };

  if (loading) return <div className="p7b-management"><Card><Skeleton lines={8} /></Card></div>;
  if (error) return <ErrorState title="Management unavailable" message={error} onRetry={load} />;
  if (!community) return <EmptyState title="Community not found" message="This management page is no longer available." actionLabel="Back to Communities" actionTo="/communities" />;

  const tabs = [
    { id: 'general', label: 'General', content: null },
    { id: 'access', label: 'Access', content: null },
    { id: 'members', label: `Members (${visibleMembers.length})`, content: null },
    { id: 'announcements', label: 'Announcements', content: null },
    { id: 'ownership', label: 'Ownership', content: null },
    { id: 'danger', label: 'Danger Zone', content: null },
  ];

  return (
    <div className="p7b-management animate-in">
      <Button type="button" variant="ghost" onClick={() => navigate(`/community/${id}`)}><ArrowLeft size={16} />Back to community</Button>
      <PageHeader
        eyebrow="Community management"
        title={community.name}
        description="Update visible community details, access rules, member roles, announcements, and protected actions."
      />

      {!admin && <Alert variant="warning" title="Limited access">Some management actions may be unavailable if your role changed.</Alert>}

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'general' && (
        <Card>
          <form className="p7b-form-section" onSubmit={saveSettings}>
            <div className="p7b-management-heading"><ShieldCheck size={20} /><h2>General settings</h2></div>
            <FormField label="Community name"><Input value={form.name} onChange={(event) => updateForm('name', event.target.value)} /></FormField>
            <FormField label="Type"><Select value={form.type} onChange={(event) => updateForm('type', event.target.value)}>{CATEGORY_OPTIONS.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</Select></FormField>
            <FormField label="Description"><Textarea rows={4} value={form.description} onChange={(event) => updateForm('description', event.target.value)} /></FormField>
            <FormField label="Address or area"><Input value={form.address} onChange={(event) => updateForm('address', event.target.value)} /></FormField>
            <div className="p7b-two-col">
              <FormField label="City"><Input value={form.city} onChange={(event) => updateForm('city', event.target.value)} /></FormField>
              <FormField label="District"><Input value={form.district} onChange={(event) => updateForm('district', event.target.value)} /></FormField>
              <FormField label="State"><Input value={form.state} onChange={(event) => updateForm('state', event.target.value)} /></FormField>
            </div>
            <Button type="submit" loading={saving === 'settings'}><Save size={16} />Save settings</Button>
          </form>
        </Card>
      )}

      {activeTab === 'access' && (
        <Card>
          <form className="p7b-form-section" onSubmit={saveSettings}>
            <div className="p7b-management-heading"><ShieldCheck size={20} /><h2>Access and join policy</h2></div>
            <FormField label="Visibility"><Select value={form.visibility} onChange={(event) => updateForm('visibility', event.target.value)}>{VISIBILITY_OPTIONS.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</Select></FormField>
            <FormField label="Join policy"><Select value={form.joinPolicy} onChange={(event) => updateForm('joinPolicy', event.target.value)}>{JOIN_POLICY_OPTIONS.map((item) => <option key={item} value={item}>{readable(item)}</option>)}</Select></FormField>
            {form.joinPolicy === 'JOIN_CODE' && <FormField label="New join code" hint="Leave blank to avoid exposing or changing the existing code."><Input value={form.verificationCode} onChange={(event) => updateForm('verificationCode', event.target.value.toUpperCase())} autoComplete="off" /></FormField>}
            {form.joinPolicy === 'EMAIL_DOMAIN' && <FormField label="Allowed email domain"><Input value={form.emailDomain} onChange={(event) => updateForm('emailDomain', event.target.value.toLowerCase())} placeholder="example.edu" /></FormField>}
            {form.joinPolicy === 'APPROVAL_REQUIRED' && <Alert title="Approval required">Members will see a pending state after submitting a join request.</Alert>}
            {form.joinPolicy === 'INVITE_ONLY' && <Alert title="Invite only">The public join button is hidden for this community.</Alert>}
            <Button type="submit" loading={saving === 'settings'}>Save access policy</Button>
          </form>
        </Card>
      )}

      {activeTab === 'members' && (
        <Card className="p7b-form-section">
          <div className="p7b-management-heading"><Users size={20} /><h2>Member controls</h2></div>
          {visibleMembers.length === 0 ? <EmptyState title="No members yet" message="Members will appear here after joining." /> : visibleMembers.map((member) => {
            const self = String(member.userId || member.id) === String(user?.userId || user?.id);
            const targetOwner = String(member.role || '').toUpperCase() === 'OWNER';
            return (
              <div key={member.id || member.userId} className="p7b-member-row">
                <div className="p7b-member-line">
                  <Avatar name={member.fullName || member.name || 'Member'} src={member.profileImage || member.avatarUrl} />
                  <span><strong>{member.fullName || member.name || 'Member'}</strong><small>Status: {readable(member.status || 'ACTIVE')}</small></span>
                </div>
                <RoleBadge role={member.role || 'MEMBER'} />
                {canManageRole(currentRole, member.role) && !self && !targetOwner ? (
                  <Select value={member.role || 'MEMBER'} onChange={(event) => changeRole(member, event.target.value)} disabled={saving === `role-${member.id}`}>
                    {ROLE_OPTIONS.filter((role) => role !== 'OWNER').map((role) => <option key={role} value={role}>{readable(role)}</option>)}
                  </Select>
                ) : <Badge variant="default">{self ? 'You' : targetOwner ? 'Owner protected' : 'Role locked'}</Badge>}
                {admin && !self && !targetOwner && (
                  <Button type="button" variant="danger" size="sm" loading={saving === `remove-${member.id}`} onClick={() => setConfirm({ type: 'remove', member })}>Remove</Button>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {activeTab === 'announcements' && (
        <div className="p7b-list">
          <Card>
            <form className="p7b-form-section" onSubmit={postAnnouncement}>
              <div className="p7b-management-heading"><Megaphone size={20} /><h2>Announcement</h2></div>
              <FormField label="Title"><Input value={announcement.title} onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })} /></FormField>
              <FormField label="Message"><Textarea rows={4} value={announcement.body} onChange={(event) => setAnnouncement({ ...announcement, body: event.target.value })} /></FormField>
              <Button type="submit" loading={saving === 'announcement'}>Post announcement</Button>
            </form>
          </Card>
          <Card>
            <form className="p7b-form-section" onSubmit={sendBroadcast}>
              <div className="p7b-management-heading"><Megaphone size={20} /><h2>Broadcast</h2></div>
              <Alert title="Member notification">Broadcast uses the existing community broadcast endpoint. It does not create local duplicate notifications.</Alert>
              <FormField label="Title"><Input value={broadcast.title} onChange={(event) => setBroadcast({ ...broadcast, title: event.target.value })} /></FormField>
              <FormField label="Message"><Textarea rows={4} value={broadcast.message} onChange={(event) => setBroadcast({ ...broadcast, message: event.target.value })} /></FormField>
              <FormField label="Urgency"><Select value={broadcast.urgency} onChange={(event) => setBroadcast({ ...broadcast, urgency: event.target.value })}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option key={item} value={item}>{readable(item)}</option>)}</Select></FormField>
              <Button type="submit" loading={saving === 'broadcast'}>Send broadcast</Button>
            </form>
          </Card>
          {announcements.length === 0 ? <EmptyState title="No announcements yet" message="Posted announcements will be shown here." /> : announcements.map((item) => (
            <Card key={item.id} className="p7b-thread-card">
              <div className="p7b-thread-top"><h3>{item.title}</h3>{(item.pinned || item.isPinned) && <Badge variant="info">Pinned</Badge>}</div>
              <p>{item.body || item.message}</p>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'ownership' && (
        <Card className="p7b-form-section">
          <div className="p7b-management-heading"><ShieldCheck size={20} /><h2>Ownership</h2></div>
          <Alert title="Owner protected">Current owner members are protected from removal and demotion.</Alert>
          <div className="p7b-review">
            <div><span>Current role</span><strong>{readable(currentRole || 'Member')}</strong></div>
            <div><span>Owner actions</span><strong>{owner ? 'Available' : 'Hidden'}</strong></div>
          </div>
        </Card>
      )}

      {activeTab === 'danger' && (
        <Card className="p7b-danger-zone">
          <div className="p7b-management-heading"><Trash2 size={20} /><h2>Danger Zone</h2></div>
          <p>Use delete only for communities that should no longer be accessible.</p>
          {owner ? (
            <Button type="button" variant="danger" onClick={() => setConfirm({ type: 'delete' })}><Trash2 size={16} />Delete community</Button>
          ) : (
            <Badge variant="warning">Owner action hidden</Badge>
          )}
        </Card>
      )}

      <ConfirmationDialog
        open={Boolean(confirm)}
        title={confirm?.type === 'delete' ? 'Delete community' : 'Remove member'}
        message={confirm?.type === 'delete'
          ? `Delete ${community.name}? This action is permanent after it is confirmed.`
          : `Remove ${confirm?.member?.fullName || 'this member'} from ${community.name}?`}
        confirmLabel={confirm?.type === 'delete' ? 'Delete community' : 'Remove member'}
        destructive
        loading={saving === 'delete' || saving.startsWith('remove-')}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.type === 'delete' ? deleteCommunity() : removeMember(confirm.member)}
      />
    </div>
  );
}
