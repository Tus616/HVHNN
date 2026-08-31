import { useEffect, useMemo, useState } from 'react';
import { Edit3, Mail, MapPin, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionHeader,
  Skeleton,
  StatCard,
  StatusBadge,
  Tabs,
} from '../components/ui';
import VerificationBadge from '../components/VerificationBadge';
import { formatDateShort, formatLocation, formatVolunteerCategory, getFriendlyProvider } from '../utils/displayFormat';
import { timeAgo } from '../utils/timeUtils';

function requestStatus(request) {
  return request?.status || request?.requestStatus || 'UNKNOWN';
}

function requestTitle(request) {
  return request?.title || request?.category || 'Help request';
}

function summarizeRequest(request) {
  return request?.description || request?.aiSummary || request?.location || 'No description available.';
}

function ActivityList({ items, emptyTitle, emptyMessage }) {
  if (!items.length) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="p7d-activity-list">
      {items.slice(0, 6).map((request) => (
        <article key={request.id || request.requestId} className="p7d-activity-row">
          <div>
            <strong>{requestTitle(request)}</strong>
            <p>{summarizeRequest(request)}</p>
            <small>{request.createdAt ? timeAgo(request.createdAt) : 'Date unavailable'}</small>
          </div>
          <StatusBadge status={requestStatus(request)} />
        </article>
      ))}
    </div>
  );
}

export default function Profile({ initialTab = 'created' }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [helpedRequests, setHelpedRequests] = useState([]);
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [impact, setImpact] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadProfile() {
    setLoading(true);
    setError('');
    try {
      const [profileRes, createdRes, helpedRes, communitiesRes, joinedRes, impactRes] = await Promise.allSettled([
        apiService.getProfile(user?.userId),
        apiService.getMyRequests(user?.userId),
        apiService.getVolunteeredRequests(user?.userId),
        apiService.getCommunities(),
        apiService.getJoinedCommunities(user?.userId),
        apiService.getUserImpact(),
      ]);

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data || user || {});
      } else {
        setProfile(user || {});
        setError(profileRes.reason?.message || 'We could not load the latest profile. Showing saved session details.');
      }

      if (createdRes.status === 'fulfilled') setMyRequests(Array.isArray(createdRes.value.data) ? createdRes.value.data : []);
      if (helpedRes.status === 'fulfilled') setHelpedRequests(Array.isArray(helpedRes.value.data) ? helpedRes.value.data : []);
      if (impactRes.status === 'fulfilled') setImpact(impactRes.value.data || null);

      if (communitiesRes.status === 'fulfilled' && joinedRes.status === 'fulfilled') {
        const allCommunities = Array.isArray(communitiesRes.value.data) ? communitiesRes.value.data : [];
        const joinedIds = new Set(Array.isArray(joinedRes.value.data) ? joinedRes.value.data.map(String) : []);
        setJoinedCommunities(allCommunities.filter((community) => joinedIds.has(String(community.id))));
      }
    } catch (loadError) {
      setError(loadError.message || 'We could not load your profile right now.');
      setProfile(user || {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [user?.userId]);

  const p = profile || user || {};
  const categories = Array.isArray(p.volunteerCategories) ? p.volunteerCategories : [];
  const activityCounts = useMemo(() => ({
    created: myRequests.length,
    helped: helpedRequests.length,
    completed: helpedRequests.filter((request) => String(requestStatus(request)).toUpperCase().includes('COMPLETE')).length,
    communities: joinedCommunities.length,
  }), [helpedRequests, joinedCommunities.length, myRequests.length]);

  if (loading) {
    return (
      <div className="animate-in p7d-page">
        <Skeleton lines={10} />
      </div>
    );
  }

  const tabs = [
    {
      id: 'created',
      label: `Created (${activityCounts.created})`,
      content: <ActivityList items={myRequests} emptyTitle="No requests created yet" emptyMessage="Requests you raise for local help will appear here." />,
    },
    {
      id: 'helped',
      label: `Helped (${activityCounts.helped})`,
      content: <ActivityList items={helpedRequests} emptyTitle="No completed help yet" emptyMessage="Accepted or completed volunteer activity will appear here." />,
    },
    {
      id: 'communities',
      label: `Communities (${activityCounts.communities})`,
      content: joinedCommunities.length ? (
        <div className="p7d-card-grid">
          {joinedCommunities.map((community) => (
            <Card key={community.id} className="p7d-compact-card">
              <strong>{community.name}</strong>
              <p>{community.address || community.location || 'Community location not set'}</p>
              <Button to={`/community/${community.id}`} variant="secondary" size="sm">Open community</Button>
            </Card>
          ))}
        </div>
      ) : <EmptyState title="No communities joined yet" message="Joined communities will appear here." actionLabel="Browse communities" actionTo="/communities" />,
    },
  ];

  return (
    <div className="animate-in p7d-page">
      <PageHeader
        eyebrow="Profile"
        title={p.fullName || 'Sahay member'}
        description="Your public identity, volunteer profile, and recent activity."
        action={<Button to="/profile/edit" variant="secondary"><Edit3 size={16} /> Edit profile</Button>}
      />

      {error && <ErrorState title="Profile partially loaded" message={error} onRetry={loadProfile} />}

      <section className="p7d-profile-grid">
        <div className="p7d-profile-left">
          <Card className="p7d-profile-card">
            <div className="p7d-profile-identity">
              <Avatar name={p.fullName || p.email} src={p.avatarUrl || p.profileImage} size="xl" />
              <div>
                <div className="p7d-title-row">
                  <h2>{p.fullName || 'Sahay member'}</h2>
                  <VerificationBadge level={p.verificationLevel || 'BASIC'} size="lg" />
                </div>
                <p><Mail size={15} aria-hidden="true" /> {p.email || 'Email not available'}</p>
                <p><MapPin size={15} aria-hidden="true" /> {formatLocation(p)}</p>
                <div className="p7d-chip-row">
                  <Badge variant={p.isVolunteer ? 'success' : 'default'}>{p.isVolunteer ? 'Volunteer enabled' : 'Volunteer disabled'}</Badge>
                  {p.createdAt && <Badge variant="default">Joined {formatDateShort(p.createdAt)}</Badge>}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="About" description="Safe public-facing profile information." />
            {p.bio ? <p className="p7d-copy">{p.bio}</p> : <EmptyState title="No bio yet" message="Add a short bio so nearby members understand how you participate." actionLabel="Edit profile" actionTo="/profile/edit" />}
          </Card>

          <Card>
            <SectionHeader title="Account" description="Your sign-in and trust details." />
            <div className="p7d-detail-list">
              <div><span>Email verified</span><strong>{p.verified || p.emailVerified ? 'Verified' : 'Not verified'}</strong></div>
              <div><span>Provider</span><strong>{getFriendlyProvider(p.authProvider || p.provider)}</strong></div>
              <div><span>Trust level</span><strong>{p.verificationLevel ? p.verificationLevel.replace(/_/g, ' ') : 'Basic'}</strong></div>
            </div>
          </Card>
        </div>

        <div className="p7d-profile-right">
          <div className="p7d-stat-grid">
            <StatCard label="Requests created" value={activityCounts.created} />
            <StatCard label="Requests helped" value={activityCounts.helped} />
            <StatCard label="Completed help" value={activityCounts.completed || impact?.totalPeopleHelped || 0} />
            <StatCard label="Communities" value={activityCounts.communities} />
          </div>

          <Card>
            <SectionHeader title="Volunteer Profile" description="Your current volunteer preferences." action={<Button to="/volunteer/settings" variant="secondary" size="sm">Manage</Button>} />
            <div className="p7d-detail-list">
              <div><span>Status</span><strong>{p.isVolunteer ? 'Enabled' : 'Disabled'}</strong></div>
              <div><span>Availability</span><strong>{p.volunteerStatus ? p.volunteerStatus.replace(/_/g, ' ') : 'Not set'}</strong></div>
              <div>
                <span>Categories</span>
                <div className="p7d-chip-row">
                  {categories.length ? categories.map((category) => <Badge key={category}>{formatVolunteerCategory(category)}</Badge>) : <Badge>None selected</Badge>}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Location Summary" description="Approximate profile location for matching." />
            <div className="p7d-location-summary">
              <ShieldCheck size={20} aria-hidden="true" />
              <div>
                <strong>{formatLocation(p)}</strong>
                <p>Your exact location is kept private.</p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <Card>
        <SectionHeader title="Activity" description="Requests and communities linked to your account." action={<Users size={18} aria-hidden="true" />} />
        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      </Card>
    </div>
  );
}
