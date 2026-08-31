import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, HeartHandshake, MapPin, Megaphone, MessageCircle, Plus, Send, ShieldCheck, ThumbsUp, Users } from 'lucide-react';
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
  Modal,
  RoleBadge,
  SectionHeader,
  Skeleton,
  StatusBadge,
  Tabs,
  Textarea,
  UrgencyBadge,
} from '../components/ui';

const MODULES = [
  { id: 'overview', label: 'Overview' },
  { id: 'requests', label: 'Requests' },
  { id: 'qa', label: 'Q&A' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'members', label: 'Members' },
  { id: 'announcements', label: 'Announcements' },
];

function cleanError(error, fallback) {
  const message = error?.response?.data?.message || error?.message || fallback;
  if (/exception|java\.|stack|trace/i.test(message)) return fallback;
  return message;
}

function readable(value, fallback = 'Not specified') {
  if (!value) return fallback;
  return String(value).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timeLabel(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isSameUser(a, b) {
  const left = String(a?.userId || a?.id || '');
  const right = String(b?.userId || b?.id || '');
  return Boolean(left && right && left === right);
}

function canManage(community, user) {
  if (user?.isAdmin) return true;
  return ['OWNER', 'ADMIN', 'MODERATOR'].includes(String(community?.currentUserRole || '').toUpperCase());
}

function canAdmin(community, user) {
  if (user?.isAdmin) return true;
  return ['OWNER', 'ADMIN'].includes(String(community?.currentUserRole || '').toUpperCase());
}

function isJoined(community) {
  return community?.membershipStatus === 'ACTIVE' || Boolean(community?.currentUserRole);
}

function Progress({ value, target }) {
  const safeTarget = Number(target || 0);
  const safeValue = Number(value || 0);
  const pct = safeTarget > 0 ? Math.min(100, Math.round((safeValue / safeTarget) * 100)) : 0;
  return (
    <div className="p7b-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% pledged`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

function ModuleCard({ icon, title, count, description, action }) {
  return (
    <Card className="p7b-module-card">
      <div>{icon}</div>
      <strong>{title}</strong>
      {count !== undefined && <span>{count}</span>}
      <p>{description}</p>
      {action}
    </Card>
  );
}

function RequestCard({ request }) {
  return (
    <Card className="p7b-thread-card">
      <div className="p7b-thread-top">
        <h3>{request.title || 'Community request'}</h3>
        <StatusBadge status={request.status || 'OPEN'} />
      </div>
      <p>{request.description || request.body || 'No description provided.'}</p>
      <div className="p7b-thread-meta">
        <span>Community scoped</span>
        <span>{request.requesterName || request.createdByName || 'Community member'}</span>
        <span>{timeLabel(request.createdAt)}</span>
      </div>
    </Card>
  );
}

function QuestionCard({ question, onOpen, onVote, votingId }) {
  return (
    <Card className="p7b-thread-card">
      <div className="p7b-thread-top">
        <button type="button" className="p7b-link-button" onClick={() => onOpen(question)}>
          <h3>{question.title}</h3>
        </button>
        {question.acceptedAnswerId && <Badge variant="success"><CheckCircle size={14} />Accepted</Badge>}
      </div>
      <p>{question.body}</p>
      <div className="p7b-thread-meta">
        <Button type="button" size="sm" variant="secondary" disabled={votingId === question.id} onClick={() => onVote(question)}>
          <ThumbsUp size={15} />{question.upvoteCount || question.voteCount || 0}
        </Button>
        <span>{question.answerCount || question.answers?.length || 0} answers</span>
        <span>{question.authorName || 'Community member'}</span>
        <span>{timeLabel(question.createdAt)}</span>
      </div>
    </Card>
  );
}

function QuestionDetail({ communityId, question, user, canAccept, onBack, onRefresh }) {
  const { showToast } = useNotifications();
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState('');

  const answers = Array.isArray(question.answers) ? question.answers : [];

  const createAnswer = async (event) => {
    event.preventDefault();
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      await apiService.createAnswer(communityId, question.id, { body: answer.trim() });
      setAnswer('');
      showToast?.({ message: 'Answer posted.', type: 'success' });
      onRefresh();
    } catch (error) {
      showToast?.({ message: cleanError(error, 'Unable to post answer.'), type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const voteAnswer = async (target) => {
    setVotingId(target.id);
    try {
      await apiService.upvoteAnswer(communityId, question.id, target.id);
      onRefresh();
    } catch (error) {
      showToast?.({ message: cleanError(error, 'Vote could not be recorded.'), type: 'error' });
    } finally {
      setVotingId('');
    }
  };

  const acceptAnswer = async (target) => {
    setVotingId(target.id);
    try {
      await apiService.acceptAnswer(communityId, question.id, target.id);
      showToast?.({ message: 'Accepted answer updated.', type: 'success' });
      onRefresh();
    } catch (error) {
      showToast?.({ message: cleanError(error, 'Unable to accept this answer.'), type: 'error' });
    } finally {
      setVotingId('');
    }
  };

  return (
    <div className="p7b-detail-thread">
      <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft size={16} />Back to Q&A</Button>
      <Card className="p7b-thread-card p7b-question-detail">
        <div className="p7b-thread-top">
          <h2>{question.title}</h2>
          {question.acceptedAnswerId && <Badge variant="success"><CheckCircle size={14} />Accepted answer</Badge>}
        </div>
        <p>{question.body}</p>
        <div className="p7b-thread-meta">
          <span>{question.authorName || 'Community member'}</span>
          <span>{timeLabel(question.createdAt)}</span>
          <span>{question.upvoteCount || question.voteCount || 0} votes</span>
        </div>
      </Card>

      <SectionHeader title="Answers" description={`${answers.length} response${answers.length === 1 ? '' : 's'} from the community`} />
      {answers.length === 0 ? (
        <EmptyState title="No answers yet" message="Add the first useful answer for this community question." />
      ) : (
        <div className="p7b-list">
          {answers.map((item) => {
            const accepted = question.acceptedAnswerId === item.id || item.accepted;
            return (
              <Card key={item.id} className={`p7b-answer-card ${accepted ? 'is-accepted' : ''}`}>
                <div className="p7b-thread-top">
                  <div className="p7b-member-line"><Avatar name={item.authorName || 'Member'} /><strong>{item.authorName || 'Community member'}</strong></div>
                  {accepted && <Badge variant="success"><CheckCircle size={14} />Accepted</Badge>}
                </div>
                <p>{item.body}</p>
                <div className="p7b-thread-meta">
                  <Button type="button" size="sm" variant="secondary" disabled={votingId === item.id} onClick={() => voteAnswer(item)}>
                    <ThumbsUp size={15} />{item.upvoteCount || item.voteCount || 0}
                  </Button>
                  {canAccept && !accepted && (
                    <Button type="button" size="sm" variant="secondary" disabled={votingId === item.id} onClick={() => acceptAnswer(item)}>Accept answer</Button>
                  )}
                  <span>{timeLabel(item.createdAt)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {user && (
        <Card>
          <form className="p7b-form-section" onSubmit={createAnswer}>
            <FormField label="Your answer">
              <Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={4} placeholder="Share a clear, practical answer." />
            </FormField>
            <Button type="submit" loading={submitting}>Post answer</Button>
          </form>
        </Card>
      )}
    </div>
  );
}

function CampaignCard({ campaign, onOpen }) {
  const target = campaign.targetAmount || campaign.target || 0;
  const pledged = campaign.collectedAmount || campaign.pledgedAmount || campaign.currentAmount || 0;
  return (
    <Card className="p7b-campaign-card">
      <div className="p7b-campaign-image" aria-hidden="true">{String(campaign.title || 'C').charAt(0)}</div>
      <div className="p7b-thread-top">
        <h3>{campaign.title}</h3>
        <StatusBadge status={campaign.status || 'ACTIVE'} />
      </div>
      <p>{campaign.story || campaign.description || 'Community campaign details will appear here.'}</p>
      <div className="p7b-thread-meta">
        {campaign.category && <Badge>{readable(campaign.category)}</Badge>}
        {campaign.urgency && <UrgencyBadge urgency={campaign.urgency} />}
        <span>{campaign.contributionCount || 0} contributions recorded</span>
      </div>
      {target > 0 && <Progress value={pledged} target={target} />}
      <Button type="button" variant="secondary" onClick={() => onOpen(campaign)}>Open campaign</Button>
    </Card>
  );
}

function CampaignDetail({ communityId, campaign, onBack, onRefresh }) {
  const { showToast } = useNotifications();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'MONEY', amount: '', details: '' });
  const [submitting, setSubmitting] = useState(false);
  const target = campaign.targetAmount || campaign.target || 0;
  const pledged = campaign.collectedAmount || campaign.pledgedAmount || campaign.currentAmount || 0;

  const contribute = async (event) => {
    event.preventDefault();
    if (!form.details.trim() && !form.amount) return;
    setSubmitting(true);
    try {
      await apiService.contributeToCampaign(communityId, campaign.id, {
        type: form.type,
        amount: form.amount ? Number(form.amount) : undefined,
        details: form.details.trim(),
      });
      showToast?.({ message: 'Contribution pledge recorded.', type: 'success' });
      setForm({ type: 'MONEY', amount: '', details: '' });
      setOpen(false);
      onRefresh();
    } catch (error) {
      showToast?.({ message: cleanError(error, 'Unable to record this contribution.'), type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p7b-detail-thread">
      <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft size={16} />Back to campaigns</Button>
      <Card className="p7b-campaign-hero">
        <div className="p7b-campaign-image" aria-hidden="true">{String(campaign.title || 'C').charAt(0)}</div>
        <div>
          <div className="p7b-thread-meta">
            <StatusBadge status={campaign.status || 'ACTIVE'} />
            {campaign.category && <Badge>{readable(campaign.category)}</Badge>}
            {campaign.urgency && <UrgencyBadge urgency={campaign.urgency} />}
          </div>
          <h2>{campaign.title}</h2>
          <p>{campaign.story || campaign.description || 'No campaign story has been provided.'}</p>
        </div>
      </Card>
      <Card className="p7b-form-section">
        <SectionHeader title="Contribution progress" description="Recorded pledges and commitments only. No payment is processed here." />
        {target > 0 && <Progress value={pledged} target={target} />}
        <div className="p7b-review">
          <div><span>Pledged</span><strong>{pledged}</strong></div>
          <div><span>Target</span><strong>{target || 'No target'}</strong></div>
          <div><span>Contributions</span><strong>{campaign.contributionCount || 0}</strong></div>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>Record contribution pledge</Button>
      </Card>
      <Modal
        open={open}
        title="Record contribution"
        onClose={() => setOpen(false)}
        footer={(
          <>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" loading={submitting} onClick={contribute}>Record pledge</Button>
          </>
        )}
      >
        <form className="p7b-form-section" onSubmit={contribute}>
          <Alert title="Pledge only">This records a commitment or pledge. It does not transfer money.</Alert>
          <FormField label="Contribution type">
            <select className="ui-input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              <option value="MONEY">Money pledge</option>
              <option value="SUPPLIES">Food, clothes, or supplies</option>
              <option value="VOLUNTEER">Volunteer time</option>
            </select>
          </FormField>
          {form.type === 'MONEY' && <FormField label="Amount"><Input type="number" min="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></FormField>}
          <FormField label="Details">
            <Textarea rows={3} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder="Describe what you can pledge or coordinate." />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}

export default function CommunityDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useNotifications();
  const [community, setCommunity] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [requests, setRequests] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [members, setMembers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [newQuestion, setNewQuestion] = useState({ title: '', body: '' });
  const [newCampaign, setNewCampaign] = useState({ title: '', story: '', category: 'COMMUNITY_SUPPORT', targetAmount: '' });
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', body: '' });
  const [memberQuery, setMemberQuery] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const loadSeq = useRef(0);

  const userId = user?.userId || user?.id;
  const joined = isJoined(community);
  const manager = canManage(community, user);
  const admin = canAdmin(community, user);

  const loadCommunity = async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError('');
    setCommunity(null);
    setDashboard(null);
    setRequests([]);
    setQuestions([]);
    setCampaigns([]);
    setMembers([]);
    setAnnouncements([]);
    setSelectedQuestion(null);
    setSelectedCampaign(null);
    try {
      const [detailRes, dashboardRes] = await Promise.all([
        apiService.getCommunityDetail(id),
        apiService.getCommunityDashboard(id).catch(() => ({ data: null })),
      ]);
      if (seq !== loadSeq.current) return;
      const detail = detailRes.data?.community || detailRes.data;
      setCommunity(detail);
      setDashboard(dashboardRes.data || null);

      const [memberRes, requestRes, questionRes, campaignRes, announcementRes] = await Promise.all([
        apiService.getCommunityMembers(id).catch(() => ({ data: [] })),
        apiService.getCommunityRequests(id).catch(() => ({ data: [] })),
        apiService.listQuestions(id).catch(() => ({ data: [] })),
        apiService.listCampaigns(id).catch(() => ({ data: [] })),
        apiService.getAnnouncements(id).catch(() => ({ data: [] })),
      ]);
      if (seq !== loadSeq.current) return;
      setMembers(memberRes.data || []);
      setRequests(requestRes.data || []);
      setQuestions(questionRes.data || []);
      setCampaigns(campaignRes.data || []);
      setAnnouncements(announcementRes.data || []);
    } catch (loadError) {
      if (seq === loadSeq.current) setError(cleanError(loadError, 'This community could not be loaded.'));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    setActiveTab('overview');
    loadCommunity();
  }, [id, userId]);

  const counts = {
    requests: dashboard?.activeRequestCount ?? requests.length,
    questions: dashboard?.openQuestionCount ?? questions.length,
    campaigns: dashboard?.activeCampaignCount ?? campaigns.length,
    members: dashboard?.memberCount ?? community?.memberCount ?? members.length,
  };

  const filteredMembers = useMemo(() => members.filter((member) => {
    const nameMatch = !memberQuery || String(member.fullName || member.name || '').toLowerCase().includes(memberQuery.toLowerCase());
    const roleMatch = !memberRole || String(member.role || '').toUpperCase() === memberRole;
    return nameMatch && roleMatch;
  }), [members, memberQuery, memberRole]);

  const joinCommunity = async (event) => {
    event?.preventDefault();
    setActionLoading('join');
    try {
      await apiService.joinCommunity(id, joinCode.trim() || undefined, userId);
      showToast?.({ message: 'Join request sent.', type: 'success' });
      setJoinOpen(false);
      setJoinCode('');
      await loadCommunity();
    } catch (joinError) {
      showToast?.({ message: cleanError(joinError, 'Unable to join this community.'), type: 'error' });
    } finally {
      setActionLoading('');
    }
  };

  const leaveCommunity = async () => {
    setActionLoading('leave');
    try {
      await apiService.leaveCommunity(id, userId);
      showToast?.({ message: 'You left the community.', type: 'success' });
      setConfirmLeave(false);
      await loadCommunity();
    } catch (leaveError) {
      showToast?.({ message: cleanError(leaveError, 'Unable to leave this community.'), type: 'error' });
    } finally {
      setActionLoading('');
    }
  };

  const createQuestion = async (event) => {
    event.preventDefault();
    if (!newQuestion.title.trim() || !newQuestion.body.trim()) return;
    setActionLoading('question');
    try {
      await apiService.createQuestion(id, newQuestion);
      setNewQuestion({ title: '', body: '' });
      setQuestionModalOpen(false);
      showToast?.({ message: 'Question posted.', type: 'success' });
      await loadCommunity();
      setActiveTab('qa');
    } catch (createError) {
      showToast?.({ message: cleanError(createError, 'Unable to post this question.'), type: 'error' });
    } finally {
      setActionLoading('');
    }
  };

  const voteQuestion = async (question) => {
    setActionLoading(`vote-${question.id}`);
    const previous = questions;
    setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, upvoteCount: (item.upvoteCount || item.voteCount || 0) + 1 } : item));
    try {
      await apiService.upvoteQuestion(id, question.id);
      await loadCommunity();
    } catch (voteError) {
      setQuestions(previous);
      showToast?.({ message: cleanError(voteError, 'Vote could not be recorded.'), type: 'error' });
    } finally {
      setActionLoading('');
    }
  };

  const createCampaign = async (event) => {
    event.preventDefault();
    if (!newCampaign.title.trim() || !newCampaign.story.trim()) return;
    setActionLoading('campaign');
    try {
      await apiService.createCampaign(id, { ...newCampaign, targetAmount: newCampaign.targetAmount ? Number(newCampaign.targetAmount) : undefined });
      setNewCampaign({ title: '', story: '', category: 'COMMUNITY_SUPPORT', targetAmount: '' });
      setCampaignModalOpen(false);
      showToast?.({ message: 'Campaign created.', type: 'success' });
      await loadCommunity();
      setActiveTab('campaigns');
    } catch (createError) {
      showToast?.({ message: cleanError(createError, 'Unable to create this campaign.'), type: 'error' });
    } finally {
      setActionLoading('');
    }
  };

  const createAnnouncement = async (event) => {
    event.preventDefault();
    if (!newAnnouncement.title.trim() || !newAnnouncement.body.trim()) return;
    setActionLoading('announcement');
    try {
      await apiService.createAnnouncement(id, newAnnouncement);
      setNewAnnouncement({ title: '', body: '' });
      setAnnouncementModalOpen(false);
      showToast?.({ message: 'Announcement posted.', type: 'success' });
      await loadCommunity();
      setActiveTab('announcements');
    } catch (createError) {
      showToast?.({ message: cleanError(createError, 'Unable to post announcement.'), type: 'error' });
    } finally {
      setActionLoading('');
    }
  };

  const messageMember = async (member) => {
    setActionLoading(`message-${member.id}`);
    try {
      await apiService.messageCommunityMember(id, member.id || member.userId);
      navigate('/chats');
    } catch (messageError) {
      showToast?.({ message: cleanError(messageError, 'Unable to open that conversation.'), type: 'error' });
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="p7b-community-detail">
        <Card className="p7b-hero-card"><Skeleton lines={6} /></Card>
        <div className="p7b-module-grid">{Array.from({ length: 4 }).map((_, index) => <Card key={index}><Skeleton lines={4} /></Card>)}</div>
      </div>
    );
  }

  if (error) return <ErrorState title="Community unavailable" message={error} onRetry={loadCommunity} />;
  if (!community) return <EmptyState title="Community not found" message="It may have moved, been deleted, or become private." actionLabel="Back to Communities" actionTo="/communities" />;

  const location = [community.city, community.state].filter(Boolean).join(', ') || community.location || community.address || 'Location shared by community';
  const pending = community.membershipStatus === 'PENDING';
  const inviteOnly = String(community.joinPolicy || '').toUpperCase() === 'INVITE_ONLY';

  const tabs = MODULES.concat(manager ? [{ id: 'manage', label: 'Manage' }] : []).map((tab) => ({
    ...tab,
    content: null,
  }));

  return (
    <div className="p7b-community-detail animate-in">
      <Card className="p7b-hero-card">
        <span hidden>{community.name}</span>
        <div className="p7b-community-avatar"><Avatar name={community.name} src={community.imageUrl || community.avatarUrl} size="lg" /></div>
        <div className="p7b-hero-main">
          <div className="p7b-thread-meta">
            <Badge variant="default">{readable(community.category || community.type || 'Community')}</Badge>
            <Badge variant={String(community.visibility).toUpperCase() === 'PUBLIC' ? 'success' : 'warning'}>{readable(community.visibility || 'Public')}</Badge>
            <Badge variant="info">{readable(community.joinPolicy || 'Open')}</Badge>
            {community.currentUserRole && <RoleBadge role={community.currentUserRole} />}
            {pending && <Badge variant="warning">Join request pending</Badge>}
          </div>
          <h2>{community.name}</h2>
          <p>{community.description || 'A verified local space for community help and coordination.'}</p>
          <span className="p7b-hero-location"><MapPin size={15} />{location}</span>
          <div className="p7b-hero-stats">
            <span><Users size={16} />{counts.members} members</span>
            <span><HeartHandshake size={16} />{counts.requests} requests</span>
            <span><MessageCircle size={16} />{counts.questions} questions</span>
            <span><Megaphone size={16} />{announcements.length} announcements</span>
          </div>
        </div>
        <div className="p7b-hero-actions">
          <Button type="button" variant="secondary" onClick={() => navigate('/communities')}><ArrowLeft size={16} />Back to Communities</Button>
          {manager ? <Button to={`/community/${id}/manage`} variant="secondary">Manage</Button> : <Button type="button" variant="secondary" disabled>Manage</Button>}
          {!joined && !pending && !inviteOnly && <Button type="button" loading={actionLoading === 'join'} onClick={() => String(community.joinPolicy || 'OPEN').toUpperCase() === 'JOIN_CODE' ? setJoinOpen(true) : joinCommunity()}>Join</Button>}
          {pending && <Button type="button" variant="secondary" disabled>Pending approval</Button>}
          {inviteOnly && !joined && <Button type="button" variant="secondary" disabled>Invitation required</Button>}
          {joined ? <Button type="button" variant="secondary" onClick={() => setConfirmLeave(true)}>Leave</Button> : <Button type="button" variant="secondary" disabled>Leave</Button>}
          {joined ? <Button type="button" onClick={() => navigate(`/create?communityId=${id}`)}><Plus size={16} />Raise Request</Button> : <Button type="button" disabled><Plus size={16} />Raise Request</Button>}
        </div>
      </Card>

      {!joined && (
        <Alert title={pending ? 'Join request pending' : inviteOnly ? 'Invite-only community' : 'Community preview'}>
          {pending ? 'Admins need to approve your request before member-only modules unlock.' : inviteOnly ? 'This community requires an invitation. Public member data and protected modules remain hidden.' : 'Join to ask questions, raise requests, contribute to campaigns, and message members.'}
        </Alert>
      )}

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <div className="p7b-list">
          <div className="p7b-module-grid">
            <ModuleCard icon={<HeartHandshake />} title="Requests" count={counts.requests} description="Open and recent help requests scoped to this community." action={<Button type="button" variant="secondary" size="sm" onClick={() => setActiveTab('requests')}>View requests</Button>} />
            <ModuleCard icon={<MessageCircle />} title="Q&A" count={counts.questions} description="Member questions, answers, votes, and accepted guidance." action={<Button type="button" variant="secondary" size="sm" onClick={() => setActiveTab('qa')}>Open Q&A</Button>} />
            <ModuleCard icon={<ShieldCheck />} title="Campaigns" count={counts.campaigns} description="Community drives and contribution pledges." action={<Button type="button" variant="secondary" size="sm" onClick={() => setActiveTab('campaigns')}>View campaigns</Button>} />
            <ModuleCard icon={<Users />} title="Members" count={counts.members} description="Safe member directory and direct-message entry." action={<Button type="button" variant="secondary" size="sm" onClick={() => setActiveTab('members')}>View members</Button>} />
          </div>
          <SectionHeader title="Latest announcements" description="Recent updates from community managers" />
          {announcements.length === 0 ? <EmptyState title="No announcements yet" message="Important community updates will appear here." /> : announcements.slice(0, 3).map((announcement) => (
            <Card key={announcement.id} className="p7b-thread-card">
              <div className="p7b-thread-top"><h3>{announcement.title}</h3>{(announcement.pinned || announcement.isPinned) && <Badge variant="info">Pinned</Badge>}</div>
              <p>{announcement.body || announcement.message}</p>
              <div className="p7b-thread-meta"><span>{announcement.authorName || 'Community team'}</span><span>{timeLabel(announcement.createdAt)}</span></div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="p7b-list">
          <SectionHeader title="Community Requests" description="Canonical request cards scoped to this community" action={joined ? <Button type="button" onClick={() => navigate(`/create?communityId=${id}`)}><Plus size={16} />Raise request</Button> : null} />
          {requests.length === 0 ? <EmptyState title="No open requests in this community" message="When members raise community-scoped requests, they will appear here." actionLabel={joined ? 'Raise a request' : undefined} onAction={() => navigate(`/create?communityId=${id}`)} /> : requests.map((request) => <RequestCard key={request.id} request={request} />)}
        </div>
      )}

      {activeTab === 'qa' && (
        selectedQuestion ? (
          <QuestionDetail communityId={id} question={selectedQuestion} user={joined ? user : null} canAccept={admin || isSameUser(selectedQuestion, user)} onBack={() => setSelectedQuestion(null)} onRefresh={loadCommunity} />
        ) : (
          <div className="p7b-list">
            <SectionHeader title="Community Q&A" description="Ask practical questions and mark useful answers." action={joined ? <Button type="button" onClick={() => setQuestionModalOpen(true)}><Plus size={16} />Ask question</Button> : null} />
            {questions.length === 0 ? <EmptyState title="No questions yet" message="Ask the first question when you are a member." /> : questions.map((question) => <QuestionCard key={question.id} question={question} onOpen={setSelectedQuestion} onVote={voteQuestion} votingId={actionLoading.replace('vote-', '')} />)}
          </div>
        )
      )}

      {activeTab === 'campaigns' && (
        selectedCampaign ? (
          <CampaignDetail communityId={id} campaign={selectedCampaign} onBack={() => setSelectedCampaign(null)} onRefresh={loadCommunity} />
        ) : (
          <div className="p7b-list">
            <SectionHeader title="Campaigns" description="Community drives, needs, and recorded pledges." action={manager ? <Button type="button" onClick={() => setCampaignModalOpen(true)}><Plus size={16} />Create campaign</Button> : null} />
            {campaigns.length === 0 ? <EmptyState title="No active campaigns" message="Community drives and pledges will appear here." /> : <div className="p7b-campaign-grid">{campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} onOpen={setSelectedCampaign} />)}</div>}
          </div>
        )
      )}

      {activeTab === 'members' && (
        <div className="p7b-list">
          <SectionHeader title="Members" description="Safe member directory with role and message controls." />
          <Card className="p7b-members-card">
            <div className="p7b-member-filters">
              <FormField label="Search members"><Input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} placeholder="Display name" /></FormField>
              <FormField label="Role"><select className="ui-input" value={memberRole} onChange={(event) => setMemberRole(event.target.value)}><option value="">All roles</option><option value="OWNER">Owner</option><option value="ADMIN">Admin</option><option value="MODERATOR">Moderator</option><option value="MEMBER">Member</option></select></FormField>
            </div>
            {filteredMembers.length === 0 ? <EmptyState title="No members matched your search" message="Try a different name or role filter." /> : <div className="p7b-member-grid">{filteredMembers.map((member) => (
              <div key={member.id || member.userId} className="p7b-member-card">
                <div className="p7b-member-line"><Avatar name={member.fullName || member.name || 'Member'} src={member.profileImage || member.avatarUrl} /><span><strong>{member.fullName || member.name || 'Member'}</strong><small>Joined {timeLabel(member.joinedAt)}</small></span></div>
                <RoleBadge role={member.role || 'MEMBER'} />
                {joined && !isSameUser(member, user) && String(member.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && (
                  <Button type="button" variant="secondary" size="sm" loading={actionLoading === `message-${member.id}`} onClick={() => messageMember(member)}><Send size={15} />Message</Button>
                )}
              </div>
            ))}</div>}
          </Card>
        </div>
      )}

      {activeTab === 'announcements' && (
        <div className="p7b-list">
          <SectionHeader title="Announcements" description="Pinned and recent updates from community leaders." action={admin ? <Button type="button" onClick={() => setAnnouncementModalOpen(true)}><Plus size={16} />Post announcement</Button> : null} />
          {announcements.length === 0 ? <EmptyState title="No announcements yet" message="Community updates will appear here." /> : announcements.map((announcement) => (
            <Card key={announcement.id} className="p7b-thread-card">
              <div className="p7b-thread-top"><h3>{announcement.title}</h3>{(announcement.pinned || announcement.isPinned) && <Badge variant="info">Pinned</Badge>}</div>
              <p>{announcement.body || announcement.message}</p>
              <div className="p7b-thread-meta"><span>{announcement.authorName || 'Community team'}</span><span>{timeLabel(announcement.createdAt)}</span></div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'manage' && manager && (
        <Card className="p7b-management-jump">
          <h2>Management tools</h2>
          <p>Open the dedicated management page to update settings, access policy, members, announcements, ownership, and protected actions.</p>
          <Button to={`/community/${id}/manage`}>Open management</Button>
        </Card>
      )}

      <Modal
        open={joinOpen}
        title="Enter join code"
        onClose={() => setJoinOpen(false)}
        footer={(
          <>
            <Button type="button" variant="secondary" onClick={() => setJoinOpen(false)}>Cancel</Button>
            <Button type="button" loading={actionLoading === 'join'} onClick={joinCommunity}>Verify and join</Button>
          </>
        )}
      >
        <form onSubmit={joinCommunity} className="p7b-form-section">
          <FormField label="Join code"><Input type="password" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} autoFocus autoComplete="off" /></FormField>
        </form>
      </Modal>

      <Modal open={questionModalOpen} title="Ask question" onClose={() => setQuestionModalOpen(false)}>
        <form className="p7b-form-section p7b-modal-form" onSubmit={createQuestion}>
          <FormField label="Question title"><Input value={newQuestion.title} onChange={(event) => setNewQuestion((current) => ({ ...current, title: event.target.value }))} maxLength={140} autoFocus /></FormField>
          <FormField label="Details"><Textarea value={newQuestion.body} onChange={(event) => setNewQuestion((current) => ({ ...current, body: event.target.value }))} rows={4} /></FormField>
          <div className="p7b-modal-actions">
            <Button type="button" variant="secondary" onClick={() => setQuestionModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={actionLoading === 'question'}>Ask question</Button>
          </div>
        </form>
      </Modal>

      <Modal open={campaignModalOpen} title="Create campaign" onClose={() => setCampaignModalOpen(false)}>
        <form className="p7b-form-section p7b-modal-form" onSubmit={createCampaign}>
          <FormField label="Campaign title"><Input value={newCampaign.title} onChange={(event) => setNewCampaign((current) => ({ ...current, title: event.target.value }))} autoFocus /></FormField>
          <FormField label="Story"><Textarea value={newCampaign.story} onChange={(event) => setNewCampaign((current) => ({ ...current, story: event.target.value }))} rows={4} /></FormField>
          <FormField label="Optional pledge target"><Input type="number" min="1" value={newCampaign.targetAmount} onChange={(event) => setNewCampaign((current) => ({ ...current, targetAmount: event.target.value }))} /></FormField>
          <div className="p7b-modal-actions">
            <Button type="button" variant="secondary" onClick={() => setCampaignModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={actionLoading === 'campaign'}>Create campaign</Button>
          </div>
        </form>
      </Modal>

      <Modal open={announcementModalOpen} title="Post announcement" onClose={() => setAnnouncementModalOpen(false)}>
        <form className="p7b-form-section p7b-modal-form" onSubmit={createAnnouncement}>
          <FormField label="Title"><Input value={newAnnouncement.title} onChange={(event) => setNewAnnouncement((current) => ({ ...current, title: event.target.value }))} autoFocus /></FormField>
          <FormField label="Message"><Textarea value={newAnnouncement.body} onChange={(event) => setNewAnnouncement((current) => ({ ...current, body: event.target.value }))} rows={4} /></FormField>
          <div className="p7b-modal-actions">
            <Button type="button" variant="secondary" onClick={() => setAnnouncementModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={actionLoading === 'announcement'}>Post announcement</Button>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        open={confirmLeave}
        title="Leave community"
        message={`Leave ${community.name}? Your member-only controls will be removed after the backend confirms.`}
        confirmLabel="Leave community"
        destructive
        loading={actionLoading === 'leave'}
        onClose={() => setConfirmLeave(false)}
        onConfirm={leaveCommunity}
      />
    </div>
  );
}
