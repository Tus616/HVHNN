import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LocationAutocompleteInput from '../components/LocationAutocompleteInput';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import apiService from '../services/api';
import { VOLUNTEER_SKILL_OPTIONS } from '../utils/volunteer';
import VoiceRecorder from '../components/VoiceRecorder';
import communityImage from '../assets/community.png';

// ---- AI Input Validation: Reject gibberish/meaningless text ----
function isGibberish(text) {
  if (!text || typeof text !== 'string') return true;
  const cleaned = text.trim().replace(/[^a-zA-Z\s]/g, '');
  if (cleaned.length < 5) return true;
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) return true;
  const vowels = 'aeiouAEIOU';
  let gibberishWords = 0;
  for (const word of words) {
    if (word.length < 2) continue;
    const vowelCount = [...word].filter(c => vowels.includes(c)).length;
    const vowelRatio = vowelCount / word.length;
    // Real words typically have >= 25% vowels
    if (vowelRatio < 0.15 && word.length > 3) gibberishWords++;
  }
  // If more than half the significant words are gibberish, reject
  const significantWords = words.filter(w => w.length > 3);
  if (significantWords.length > 0 && gibberishWords / significantWords.length > 0.5) return true;
  return false;
}

function validateRequestInput(title, description) {
  if (isGibberish(title)) return 'Invalid request: Please enter a meaningful title.';
  if (isGibberish(description)) return 'Invalid request: Please enter a meaningful description.';
  if (description.trim().length < 20) return 'Description must be at least 20 characters.';
  return null;
}



const CATEGORIES = [
  { value: 'BLOOD_DONATION', label: 'Blood Donation' },
  { value: 'MEDICAL', label: 'Medical Assistance' },
  { value: 'FOOD', label: 'Food Support' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'GENERAL', label: 'General Help' },
];

const URGENCIES = [
  { value: 'CRITICAL', label: 'Critical - Life threatening' },
  { value: 'HIGH', label: 'High - Urgent attention needed' },
  { value: 'MEDIUM', label: 'Medium - Important but not urgent' },
  { value: 'LOW', label: 'Low - Can wait' },
];

export default function CreateRequest() {
  const { user } = useAuth();
  const { notifyRequestCreated } = useNotifications();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetCommunityId = searchParams.get('communityId') || '';
  const [loading, setLoading] = useState(false);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [form, setForm] = useState({
    communityId: presetCommunityId,
    title: '',
    description: '',
    category: '',
    urgency: '',
    address: '',
    contactPhone: user?.phone || '',
    latitude: null,
    longitude: null,
    requiredBloodGroup: '',
    requiredSkill: '',
    helpNeededWithinMinutes: '', // Time constraint for dynamic radius
    documentBase64: null,        // For OCR validation
    documentMimeType: null,
    rawInput: '',                // For AI Magic Parse
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);

  useEffect(() => {
    loadJoinedCommunities();
  }, [user?.userId]);

  async function loadJoinedCommunities() {
    try {
      const [communitiesRes, joinedRes] = await Promise.all([
        apiService.getCommunities(),
        apiService.getJoinedCommunities(user?.userId),
      ]);

      const joinedIds = new Set(joinedRes.data || []);
      const visibleCommunities = (communitiesRes.data || []).filter((community) => joinedIds.has(community.id));
      setJoinedCommunities(visibleCommunities);

      if (presetCommunityId) {
        const presetCommunity = visibleCommunities.find(
          (community) => String(community.id) === String(presetCommunityId)
        );

        if (presetCommunity) {
          setForm((current) => ({
            ...current,
            communityId: String(presetCommunity.id),
            address: current.address || presetCommunity.address || '',
          }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCommunities(false);
    }
  }

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handleAddressChange(address) {
    setForm((current) => ({
      ...current,
      address,
      latitude: null,
      longitude: null,
    }));
  }

  function handleAddressSelect(suggestion) {
    setForm((current) => ({
      ...current,
      address: suggestion.displayName,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    }));
  }

  function handleCommunityChange(event) {
    const nextCommunityId = event.target.value;
    const selectedCommunity = joinedCommunities.find(
      (community) => String(community.id) === String(nextCommunityId)
    );

    setForm((current) => ({
      ...current,
      communityId: nextCommunityId,
      address: current.address || selectedCommunity?.address || '',
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    // AI Input Validation: block gibberish before sending to backend
    const validationError = validateRequestInput(form.title, form.description);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      // Create the request - backend logic now handles OCR and Categorization in one pass
      const res = await apiService.createRequest(form, user);

      notifyRequestCreated(res.data);
      setSuccess(true);
      setTimeout(() => navigate(form.communityId ? `/community/${form.communityId}` : '/feed'), 1500);
    } catch (err) {
      console.error('Failed to create request:', err);
      setError(err.message || 'Failed to create request.');
    } finally {
      setLoading(false);
    }
  }

  function handleVoiceTranscript(text) {
    setForm(current => ({
      ...current,
      description: current.description ? `${current.description} ${text}` : text
    }));
  }

  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Read the file as Base64 for OCR processing
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result.split(',')[1];
      setForm((current) => ({
        ...current,
        documentBase64: base64Data,
        documentMimeType: file.type
      }));
    };
    reader.readAsDataURL(file);
  }

  async function handleAiParse() {
    if (!form.description.trim() || form.description.length < 20) return;
    if (form.category && form.urgency) return; // Don't overwrite if already set

    setAiLoading(true);
    setError('');
    try {
      const res = await apiService.ai.parseRequest(form.description);
      const data = res.data;
      
      setForm(prev => ({
        ...prev,
        category: prev.category || data.category,
        urgency: prev.urgency || data.urgency,
        title: prev.title || (data.category ? `Need Help: ${data.category.replace('_', ' ')}` : ''),
        address: prev.address || data.extracted_info?.location_hint || '',
        requiredBloodGroup: prev.requiredBloodGroup || data.extracted_info?.blood_group || ''
      }));
      setAiApplied(true);
      setTimeout(() => setAiApplied(false), 3000);
    } catch (err) {
      console.warn('Silent AI parsing failed:', err);
    } finally {
      setAiLoading(false);
    }
  }


  const selectedCommunity = joinedCommunities.find(
    (community) => String(community.id) === String(form.communityId)
  );

  if (success) {
    return (
      <div className="auth-page animate-in">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>Done</div>
          <h2 style={{ WebkitTextFillColor: 'var(--success)', background: 'none' }}>Request Created!</h2>
          <p className="auth-subtitle">
            Your help request has been posted.
            {selectedCommunity ? ` It has been shared with ${selectedCommunity.name}.` : ''}
            <br />
            AI has analyzed and categorized it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Raise a Help Request</h1>
          {selectedCommunity && (
            <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
              Posting inside <strong style={{ color: 'var(--text-primary)' }}>{selectedCommunity.name}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="create-request-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '40px', alignItems: 'start' }}>
        <div style={{ maxWidth: '760px' }}>
          <div
            className="card"
            style={{
              marginBottom: '20px',
              border: '1px solid rgba(99,102,241,0.2)',
              background: 'rgba(99,102,241,0.05)',
            }}
          >
            <p style={{ fontSize: '0.9rem', color: 'var(--accent-primary)' }}>
              <strong>AI-powered:</strong> Leave category and urgency blank to let the app analyze
              and organize your request automatically.
            </p>
          </div>

          {joinedCommunities.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '16px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>
                    Share this request with a joined community
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Pick a community to keep the request visible inside that joined member page.
                  </p>
                </div>
                <div style={{ minWidth: '280px', flex: '1 1 280px' }}>
                  <select
                    className="form-select"
                    value={form.communityId}
                    onChange={handleCommunityChange}
                    disabled={loadingCommunities}
                  >
                    <option value="">Post without a community</option>
                    {joinedCommunities.map((community) => (
                      <option key={community.id} value={community.id}>
                        {community.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger)',
                fontSize: '0.9rem',
                marginBottom: '20px',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                type="text"
                name="title"
                className="form-input"
                placeholder="Brief title describing what help you need"
                value={form.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <div className="flex justify-between items-center mb-2">
                <label className="form-label mb-0">Description *</label>
                <VoiceRecorder onTranscript={handleVoiceTranscript} />
              </div>
              <textarea
                name="description"
                className="form-textarea"
                placeholder="Describe the situation, what kind of help is needed, and any timing or location details."
                value={form.description}
                onChange={handleChange}
                onBlur={handleAiParse}
                required
                rows={5}
              />
              {aiLoading && <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>✨ AI Analyzing your request...</div>}
              {aiApplied && <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px' }}>✅ AI suggested categories & urgency based on your text</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select name="category" className="form-select" value={form.category} onChange={handleChange}>
                  {CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Urgency</label>
                <select name="urgency" className="form-select" value={form.urgency} onChange={handleChange}>
                  {URGENCIES.map((urgency) => (
                    <option key={urgency.value} value={urgency.value}>
                      {urgency.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Time Constraint (Optional)</label>
              <select name="helpNeededWithinMinutes" className="form-select" value={form.helpNeededWithinMinutes} onChange={handleChange}>
                <option value="">No specific time constraint</option>
                <option value="15">Within 15 minutes (Emergency)</option>
                <option value="30">Within 30 minutes</option>
                <option value="60">Within 1 hour</option>
                <option value="120">Within 2 hours</option>
                <option value="240">Within 4 hours</option>
                <option value="480">By End of Day</option>
              </select>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                AI analyzes traffic & time to dynamically calculate how far volunteers can be notified. 
                Shorter time constraints mean narrower radius + immediate network relays.
              </p>
            </div>

            {form.category === 'BLOOD_DONATION' && (
              <div className="form-group" style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', marginTop: '16px' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🩸 Required Blood Group
                </label>
                <select name="requiredBloodGroup" className="form-select" value={form.requiredBloodGroup} onChange={handleChange}>
                  <option value="">Let AI Extract from Description</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  We will actively match and notify verified community donors with compatible blood types.
                </p>
              </div>
            )}

            <div className="form-group" style={{ padding: '16px', border: '1px solid var(--border-subtle)', borderRadius: '12px', marginTop: '16px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎯 Preferred Volunteer Skill
              </label>
              <select name="requiredSkill" className="form-select" value={form.requiredSkill} onChange={handleChange}>
                <option value="">Let AI Match Best Volunteer</option>
                {VOLUNTEER_SKILL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                ))}
              </select>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                If selected, only volunteers with this specific skill will be notified for matching.
              </p>
            </div>

            {form.category === 'MEDICAL' && (
              <div className="form-group" style={{ padding: '16px', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', marginTop: '16px' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                  🏥 Upload Medical Document for Priority Verification (Optional)
                </label>
                <input
                  type="file"
                  accept="image/jpeg, image/png, application/pdf"
                  className="form-input"
                  style={{ background: 'white' }}
                  onChange={handleFileUpload}
                />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Our AI (Google Gemini Vision) will OCR the document to extract patient details, date, and doctor's signature to authenticate this request. Verified cases get higher trust scores and faster response.
                </p>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Location / Address *</label>
              <LocationAutocompleteInput
                name="address"
                placeholder="Street, area, landmark"
                value={form.address}
                onValueChange={handleAddressChange}
                onSuggestionSelect={handleAddressSelect}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input
                type="tel"
                name="contactPhone"
                className="form-input"
                placeholder="+91-XXXXXXXXXX"
                value={form.contactPhone}
                onChange={handleChange}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {loading ? 'Creating...' : 'Submit Request'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={() => navigate(form.communityId ? `/community/${form.communityId}` : '/feed')}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Side Panel Illustration */}
        <div className="hidden desktop:block animate-in slide-in-from-right duration-700" style={{ position: 'sticky', top: '24px' }}>
          <div className="card" style={{ padding: '32px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <img src={communityImage} alt="" style={{ width: '100%', maxWidth: '240px', margin: '0 auto 24px', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.2))' }} className="animate-float" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '12px' }}>Your Community is Here</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Raising a request notifies verified volunteers in your network immediately. 
              Our AI will help categorize your request for faster response times.
            </p>
            <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)', textAlign: 'left' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>TIP</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Use the Voice Recorder (🎤) to quickly describe your situation without typing.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
