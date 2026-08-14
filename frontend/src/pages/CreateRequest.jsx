import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ClipboardCheck, HeartHandshake, LocateFixed, MapPin, MessageSquareText, Phone, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import apiService from '../services/api';
import { normalizeApiError } from '../utils/errors';
import { VOLUNTEER_SKILL_OPTIONS } from '../utils/volunteer';
import LocationAutocompleteInput from '../components/LocationAutocompleteInput';
import { Alert, Badge, Button, Card, FormField, Input, RadioGroup, Select, Textarea, UrgencyBadge } from '../components/ui';

const CATEGORIES = [
  { value: 'BLOOD_DONATION', label: 'Blood Donation' },
  { value: 'MEDICAL', label: 'Medical Assistance' },
  { value: 'FOOD', label: 'Food Support' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'GENERAL', label: 'General Help' },
];

const URGENCIES = [
  { value: 'LOW', label: 'Low', description: 'Can wait, useful for non-urgent community help.' },
  { value: 'MEDIUM', label: 'Medium', description: 'Important but not immediately dangerous.' },
  { value: 'HIGH', label: 'High', description: 'Needs quick attention from nearby volunteers.' },
  { value: 'CRITICAL', label: 'Critical', description: 'Use only for serious, time-sensitive safety or health needs.' },
];

const STEPS = [
  { id: 'details', label: 'Help Details', icon: MessageSquareText },
  { id: 'urgency', label: 'Urgency', icon: ShieldAlert },
  { id: 'location', label: 'Location', icon: MapPin },
  { id: 'more', label: 'More Details', icon: Phone },
  { id: 'review', label: 'Review', icon: ClipboardCheck },
];

function meaningful(text, min = 5) {
  return String(text || '').trim().length >= min;
}

export default function CreateRequest() {
  const { user } = useAuth();
  const { notifyRequestCreated, showToast } = useNotifications();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetCommunityId = searchParams.get('communityId') || '';
  const [activeStep, setActiveStep] = useState('details');
  const [loading, setLoading] = useState(false);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [mlSuggestion, setMlSuggestion] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [duplicateDismissed, setDuplicateDismissed] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Choose how volunteers should understand the help location.');
  const [locationLoading, setLocationLoading] = useState(false);
  const [form, setForm] = useState({
    communityId: presetCommunityId,
    title: '',
    description: '',
    category: 'GENERAL',
    urgency: 'MEDIUM',
    address: '',
    city: user?.city || '',
    district: user?.district || '',
    state: user?.state || '',
    postalCode: user?.postalCode || '',
    locationSource: 'MANUAL',
    contactPhone: user?.phone || '',
    requiredSkill: '',
    requiredBloodGroup: '',
    helpNeededWithinMinutes: '',
    latitude: null,
    longitude: null,
  });

  useEffect(() => {
    let active = true;
    async function loadJoinedCommunities() {
      try {
        const [communitiesRes, joinedRes] = await Promise.all([
          apiService.getCommunities(),
          apiService.getJoinedCommunities(user?.userId),
        ]);
        if (!active) return;
        const joinedIds = new Set(joinedRes.data || []);
        const visible = (communitiesRes.data || []).filter((community) => joinedIds.has(community.id));
        setJoinedCommunities(visible);
      } catch {
        setJoinedCommunities([]);
      } finally {
        if (active) setLoadingCommunities(false);
      }
    }
    loadJoinedCommunities();
    return () => { active = false; };
  }, [user?.userId]);

  const selectedCommunity = joinedCommunities.find((community) => String(community.id) === String(form.communityId));
  const stepIndex = STEPS.findIndex((step) => step.id === activeStep);
  const currentStep = STEPS.find((step) => step.id === activeStep);
  const CurrentStepIcon = currentStep.icon;

  const setValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: '' }));
    if (['title', 'description', 'category', 'city', 'district', 'state', 'latitude', 'longitude'].includes(key)) {
      setDuplicateWarning(null);
      setDuplicateDismissed(false);
    }
  };

  const validate = (targetStep = activeStep) => {
    const next = {};
    if (targetStep === 'details' || targetStep === 'review') {
      if (!meaningful(form.title, 5)) next.title = 'Use a short, meaningful title.';
      if (!meaningful(form.description, 20)) next.description = 'Describe the request in at least 20 characters.';
      if (!form.category) next.category = 'Choose a category.';
    }
    if (targetStep === 'urgency' || targetStep === 'review') {
      if (!form.urgency) next.urgency = 'Choose an urgency level.';
    }
    if (targetStep === 'location' || targetStep === 'review') {
      if (!meaningful(form.address, 4) && !form.city && !form.district && !form.state) {
        next.address = 'Add an address or at least one area field.';
      }
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const loadMlSuggestion = async () => {
    if (!meaningful(form.title, 5) || !meaningful(form.description, 20)) return;
    setMlLoading(true);
    try {
      const response = await apiService.analyzeRequestMl(form);
      const suggestion = response.data || {};
      if (suggestion.available && suggestion.suggestionAvailable) {
        setMlSuggestion(suggestion);
      } else {
        setMlSuggestion(null);
      }
    } catch {
      setMlSuggestion(null);
    } finally {
      setMlLoading(false);
    }
  };

  const checkDuplicate = async () => {
    try {
      const response = await apiService.detectDuplicateRequest(form);
      const result = response.data || {};
      if (result.duplicateLikely) {
        setDuplicateWarning(result);
        return true;
      }
    } catch {
      setDuplicateWarning(null);
    }
    return false;
  };

  const applyMlSuggestion = () => {
    setForm((current) => ({
      ...current,
      category: mlSuggestion?.categorySuggestionAvailable ? mlSuggestion.predictedCategory : current.category,
      urgency: mlSuggestion?.urgencySuggestionAvailable ? mlSuggestion.predictedUrgency : current.urgency,
    }));
    setMlSuggestion(null);
  };

  const goNext = async () => {
    if (!validate(activeStep)) return;
    if (activeStep === 'details') {
      await loadMlSuggestion();
    }
    if (activeStep === 'location' && !duplicateDismissed) {
      await checkDuplicate();
    }
    setActiveStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)].id);
  };

  const goBack = () => setActiveStep(STEPS[Math.max(stepIndex - 1, 0)].id);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Browser location is unavailable. Enter location manually.');
      return;
    }
    setLocationLoading(true);
    setLocationStatus('Detecting your approximate location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          address: current.address || 'Current browser location',
          locationSource: 'BROWSER',
        }));
        setLocationStatus('Current browser location attached. Your exact location stays private.');
        setLocationLoading(false);
      },
      (geoError) => {
        setLocationStatus(geoError.code === geoError.PERMISSION_DENIED
          ? 'Location permission denied. Manual city or address works too.'
          : 'Could not read location. Retry or enter manually.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const useProfileLocation = () => {
    if (!Number.isFinite(Number(user?.latitude)) || !Number.isFinite(Number(user?.longitude))) {
      setLocationStatus('Your profile does not have a saved current location yet.');
      return;
    }
    setForm((current) => ({
      ...current,
      address: user.address || current.address || 'Saved profile location',
      city: user.city || current.city,
      district: user.district || current.district,
      state: user.state || current.state,
      postalCode: user.postalCode || current.postalCode,
      latitude: Number(user.latitude),
      longitude: Number(user.longitude),
      locationSource: 'PROFILE',
    }));
    setLocationStatus('Saved profile location selected.');
  };

  const handleAddressSelect = (suggestion) => {
    const address = suggestion.address || {};
    setForm((current) => ({
      ...current,
      address: suggestion.displayName,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      city: address.city || address.town || address.village || current.city,
      district: address.county || address.state_district || current.district,
      state: address.state || current.state,
      postalCode: address.postcode || current.postalCode,
      locationSource: 'MANUAL',
    }));
    setLocationStatus('Verified map suggestion selected.');
  };

  const reviewRows = useMemo(() => ([
    ['Title', form.title || 'Not added'],
    ['Category', CATEGORIES.find((item) => item.value === form.category)?.label || form.category],
    ['Urgency', form.urgency],
    ['Location', [form.address, form.city, form.district, form.state].filter(Boolean).join(', ') || 'Not added'],
    ['Contact', form.contactPhone || 'In-app updates only'],
    ['Community', selectedCommunity?.name || 'No community scope'],
  ]), [form, selectedCommunity]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!validate('review')) {
      setActiveStep('details');
      return;
    }
    setLoading(true);
    try {
      if (!duplicateDismissed && await checkDuplicate()) {
        setLoading(false);
        setActiveStep('review');
        return;
      }
      const response = await apiService.createRequest(form, user);
      notifyRequestCreated?.(response.data);
      showToast({ type: 'success', title: 'Request posted', message: 'Nearby verified helpers can now respond.' });
      navigate(`/request/${response.data.id}`);
    } catch (err) {
      const normalized = normalizeApiError(err, 'Could not create the request.');
      setError(normalized.message);
      setFieldErrors(normalized.fieldErrors || {});
      showToast({ type: 'error', title: 'Request not posted', message: normalized.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p7-create">
      <section className="p7-create-hero">
        <div>
          <Badge variant="info">Raise Request</Badge>
          <h1>Tell Sahay what help is needed.</h1>
          <p>A guided request keeps volunteers focused on the right details without exposing unnecessary private data.</p>
        </div>
      </section>

      <div className="p7-create-layout">
        {Object.values(fieldErrors).some(Boolean) && (
          <div className="p7-error-summary" role="alert" aria-live="assertive">
            <strong>Review these fields</strong>
            <ul>
              {Object.entries(fieldErrors).filter(([, message]) => message).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <aside className="p7-stepper" aria-label="Request form progress">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === activeStep;
            const isDone = index < stepIndex;
            return (
              <button key={step.id} type="button" className={`${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`} onClick={() => setActiveStep(step.id)}>
                <span>{isDone ? <CheckCircle2 size={18} /> : <Icon size={18} />}</span>
                <strong>{step.label}</strong>
              </button>
            );
          })}
        </aside>

        <form className="p7-create-form" onSubmit={handleSubmit}>
          <Card className="p7-form-card">
            <div className="p7-progress-bar" aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}>
              <span style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
            </div>
            <div className="p7-form-card__header">
              <CurrentStepIcon size={22} />
              <div>
                <h2>{currentStep.label}</h2>
                <p>Step {stepIndex + 1} of {STEPS.length}</p>
              </div>
            </div>

            {error && <Alert variant="danger" title="Check this request">{error}</Alert>}

            {activeStep === 'details' && (
              <div className="p7-form-section">
                {joinedCommunities.length > 0 && (
                  <FormField label="Community scope">
                    <Select value={form.communityId} onChange={(event) => setValue('communityId', event.target.value)} disabled={loadingCommunities}>
                      <option value="">No community scope</option>
                      {joinedCommunities.map((community) => <option key={community.id} value={community.id}>{community.name}</option>)}
                    </Select>
                  </FormField>
                )}
                <FormField label="Request title" error={fieldErrors.title} hint="Example: Need transport to clinic this evening">
                  <Input value={form.title} onChange={(event) => setValue('title', event.target.value)} />
                </FormField>
                <FormField label="Description" error={fieldErrors.description} hint="Add timing, what happened, and what kind of help would be useful.">
                  <Textarea rows={6} value={form.description} onChange={(event) => setValue('description', event.target.value)} />
                </FormField>
                <FormField label="Category" error={fieldErrors.category}>
                  <Select value={form.category} onChange={(event) => setValue('category', event.target.value)}>
                    {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </Select>
                </FormField>
                {mlLoading && <Alert title="Checking request details">Sahay intelligence is reviewing category and urgency signals.</Alert>}
                {mlSuggestion && (
                  <Alert variant="info" title="Suggested from request text">
                    <div className="p7-inline-actions">
                      <span>
                        {mlSuggestion.categorySuggestionAvailable && `Category: ${CATEGORIES.find((item) => item.value === mlSuggestion.predictedCategory)?.label || mlSuggestion.predictedCategory} (${Math.round(Number(mlSuggestion.categoryConfidence || 0) * 100)}%)`}
                        {mlSuggestion.categorySuggestionAvailable && mlSuggestion.urgencySuggestionAvailable ? ' | ' : ''}
                        {mlSuggestion.urgencySuggestionAvailable && `Urgency: ${mlSuggestion.predictedUrgency} (${Math.round(Number(mlSuggestion.urgencyConfidence || 0) * 100)}%)`}
                      </span>
                      <Button type="button" size="sm" onClick={applyMlSuggestion}>Apply Suggestions</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setMlSuggestion(null)}>Keep Mine</Button>
                    </div>
                    {mlSuggestion.safetyReason && <small>{mlSuggestion.safetyReason}</small>}
                  </Alert>
                )}
              </div>
            )}

            {activeStep === 'urgency' && (
              <div className="p7-urgency-grid">
                {URGENCIES.map((urgency) => (
                  <button key={urgency.value} type="button" className={form.urgency === urgency.value ? 'is-selected' : ''} onClick={() => setValue('urgency', urgency.value)}>
                    <UrgencyBadge urgency={urgency.value} />
                    <strong>{urgency.label}</strong>
                    <span>{urgency.description}</span>
                  </button>
                ))}
                {form.urgency === 'CRITICAL' && (
                  <Alert variant="warning" title="Critical request safety note">
                    Use this only for serious time-sensitive help. Contact emergency services first when life or safety is at immediate risk.
                  </Alert>
                )}
              </div>
            )}

            {activeStep === 'location' && (
              <div className="p7-form-section">
                <RadioGroup
                  label="Location mode"
                  name="locationSource"
                  value={form.locationSource}
                  onChange={(value) => setValue('locationSource', value)}
                  options={[
                    { value: 'MANUAL', label: 'Enter manually' },
                    { value: 'BROWSER', label: 'Use current location' },
                    { value: 'PROFILE', label: 'Use saved profile' },
                  ]}
                />
                <div className="p7-location-actions">
                  <Button type="button" variant="secondary" onClick={useCurrentLocation} loading={locationLoading}><LocateFixed size={16} /> Use Current Location</Button>
                  <Button type="button" variant="secondary" onClick={useProfileLocation}><MapPin size={16} /> Use Profile Location</Button>
                </div>
                <Alert title="Location status">{locationStatus}</Alert>
                <FormField label="Address or landmark" error={fieldErrors.address}>
                  <LocationAutocompleteInput
                    value={form.address}
                    onValueChange={(value) => setValue('address', value)}
                    onSuggestionSelect={handleAddressSelect}
                    placeholder="Street, landmark, society, or public place"
                  />
                </FormField>
                <div className="p7-field-grid">
                  <FormField label="City"><Input value={form.city} onChange={(event) => setValue('city', event.target.value)} /></FormField>
                  <FormField label="District"><Input value={form.district} onChange={(event) => setValue('district', event.target.value)} /></FormField>
                  <FormField label="State"><Input value={form.state} onChange={(event) => setValue('state', event.target.value)} /></FormField>
                  <FormField label="Postal code"><Input value={form.postalCode} onChange={(event) => setValue('postalCode', event.target.value)} /></FormField>
                </div>
              </div>
            )}

            {activeStep === 'more' && (
              <div className="p7-form-section">
                <FormField label="Preferred volunteer skill">
                  <Select value={form.requiredSkill} onChange={(event) => setValue('requiredSkill', event.target.value)}>
                    <option value="">Any verified helper</option>
                    {VOLUNTEER_SKILL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                </FormField>
                {form.category === 'BLOOD_DONATION' && (
                  <FormField label="Required blood group">
                    <Select value={form.requiredBloodGroup} onChange={(event) => setValue('requiredBloodGroup', event.target.value)}>
                      <option value="">Mentioned in description</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => <option key={group} value={group}>{group}</option>)}
                    </Select>
                  </FormField>
                )}
                <FormField label="Contact phone" hint="Optional. In-app updates remain available.">
                  <Input type="tel" value={form.contactPhone} onChange={(event) => setValue('contactPhone', event.target.value)} />
                </FormField>
                <FormField label="Help needed within">
                  <Select value={form.helpNeededWithinMinutes} onChange={(event) => setValue('helpNeededWithinMinutes', event.target.value)}>
                    <option value="">No specific time</option>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="240">4 hours</option>
                    <option value="480">Today</option>
                  </Select>
                </FormField>
              </div>
            )}

            {activeStep === 'review' && (
              <div className="p7-review-card">
                {duplicateWarning && (
                  <Alert variant="warning" title="Similar nearby request found">
                    <div className="p7-inline-actions">
                      <span>
                        {duplicateWarning.matchingTitle || 'Existing matching request'}
                        {Number.isFinite(Number(duplicateWarning.distanceKm)) ? ` | ${Number(duplicateWarning.distanceKm).toFixed(1)} km away` : ''}
                        {Number.isFinite(Number(duplicateWarning.textSimilarity ?? duplicateWarning.similarityScore)) ? ` | ${Math.round(Number(duplicateWarning.textSimilarity ?? duplicateWarning.similarityScore) * 100)}% similar` : ''}
                        {duplicateWarning.reason ? ` | ${duplicateWarning.reason}` : ''}
                      </span>
                      {duplicateWarning.matchingRequestId && (
                        <Button type="button" size="sm" variant="secondary" onClick={() => navigate(`/request/${duplicateWarning.matchingRequestId}`)}>View Existing</Button>
                      )}
                      <Button type="button" size="sm" onClick={() => {
                        setDuplicateDismissed(true);
                        setDuplicateWarning(null);
                      }}>Continue Anyway</Button>
                    </div>
                  </Alert>
                )}
                {reviewRows.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
                <Alert title="Before posting">Sahay will check the request details, safety signals, and your account permissions.</Alert>
              </div>
            )}

            <div className="p7-form-actions">
              <Button type="button" variant="secondary" onClick={goBack} disabled={stepIndex === 0 || loading}>Back</Button>
              {activeStep === 'review' ? (
                <Button type="submit" loading={loading}><HeartHandshake size={16} /> Submit Request</Button>
              ) : (
                <Button type="button" onClick={goNext}>Continue</Button>
              )}
            </div>
          </Card>
        </form>

        <aside className="p7-create-help">
          <Card>
            <AlertTriangle size={22} />
            <h2>Keep it useful and safe</h2>
            <p>Share what happened, where help is needed, and what a volunteer can realistically do. Avoid sharing sensitive IDs or private medical details unless required.</p>
          </Card>
          <Card>
            <MapPin size={22} />
            <h2>Location privacy</h2>
            <p>Coordinates help matching, but the visible UI emphasizes safe location summaries rather than raw latitude and longitude.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
