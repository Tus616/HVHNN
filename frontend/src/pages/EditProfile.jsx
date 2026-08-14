import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ImagePlus, LocateFixed, Save, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';
import {
  Alert,
  Avatar,
  Button,
  Card,
  ConfirmationDialog,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  SectionHeader,
  Skeleton,
  Textarea,
} from '../components/ui';
import { normalizeApiError } from '../utils/errors';
import { formatLocation } from '../utils/displayFormat';
import LocationAutocompleteInput from '../components/LocationAutocompleteInput';

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  bio: '',
  address: '',
  city: '',
  district: '',
  state: '',
  postalCode: '',
  latitude: null,
  longitude: null,
  locationSource: 'UNKNOWN',
  clearLocation: false,
};

function pickProfile(profile = {}) {
  return {
    fullName: profile.fullName || '',
    phone: profile.phone || '',
    bio: profile.bio || '',
    address: profile.address || '',
    city: profile.city || '',
    district: profile.district || '',
    state: profile.state || '',
    postalCode: profile.postalCode || '',
    latitude: profile.latitude ?? null,
    longitude: profile.longitude ?? null,
    locationSource: profile.locationSource || 'UNKNOWN',
    clearLocation: false,
  };
}

function validate(form) {
  const errors = {};
  if (!form.fullName.trim()) errors.fullName = 'Display name is required.';
  if (form.fullName.trim().length > 80) errors.fullName = 'Display name must be 80 characters or fewer.';
  if (form.phone && !/^[+()\-\s0-9]{7,20}$/.test(form.phone)) errors.phone = 'Enter a valid phone number.';
  if (form.postalCode && !/^[A-Za-z0-9\-\s]{3,12}$/.test(form.postalCode)) errors.postalCode = 'Enter a valid postal code.';
  if (form.bio.length > 500) errors.bio = 'Bio must be 500 characters or fewer.';
  return errors;
}

export default function EditProfile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [confirmAvatarRemove, setConfirmAvatarRemove] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  async function loadProfile() {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.getProfile(user?.userId);
      setForm(pickProfile(response.data || user || {}));
      updateUser?.(response.data || {});
    } catch (loadError) {
      setForm(pickProfile(user || {}));
      setError(normalizeApiError(loadError, 'Could not load latest profile details.').message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, [user?.userId]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: '' }));
  }

  const locationLabel = useMemo(() => formatLocation(form), [form]);
  const avatarUrl = avatarPreview || user?.profileImage || user?.avatarUrl || '';

  function applyLocationSuggestion(suggestion) {
    setForm((current) => ({
      ...current,
      address: suggestion.displayName || current.address,
      city: suggestion.city || suggestion.address?.city || suggestion.address?.town || current.city,
      district: suggestion.district || suggestion.address?.state_district || suggestion.address?.county || current.district,
      state: suggestion.state || suggestion.address?.state || current.state,
      latitude: Number.isFinite(suggestion.latitude) ? suggestion.latitude : current.latitude,
      longitude: Number.isFinite(suggestion.longitude) ? suggestion.longitude : current.longitude,
      locationSource: 'VERIFIED_PROVIDER',
      clearLocation: false,
    }));
  }

  function validateAvatar(file) {
    if (!file) return 'Choose an image file.';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Avatar must be JPG, PNG, or WebP.';
    if (file.size > 2 * 1024 * 1024) return 'Avatar must be 2 MB or smaller.';
    return '';
  }

  function chooseAvatar(event) {
    const file = event.target.files?.[0];
    const message = validateAvatar(file);
    if (message) {
      setError(message);
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setNotice('Preview ready. Upload to save this profile photo.');
    setError('');
  }

  async function uploadAvatar() {
    const message = validateAvatar(avatarFile);
    if (message) {
      setError(message);
      return;
    }
    setAvatarUploading(true);
    setError('');
    try {
      const response = await apiService.uploadAvatar(avatarFile);
      updateUser?.(response.data || {});
      setAvatarFile(null);
      setAvatarPreview('');
      setNotice('Profile photo updated.');
    } catch (avatarError) {
      setError(normalizeApiError(avatarError, 'Could not upload profile photo.').message);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function removeAvatar() {
    setAvatarUploading(true);
    setError('');
    try {
      const response = await apiService.removeAvatar();
      updateUser?.(response.data || {});
      setAvatarFile(null);
      setAvatarPreview('');
      setConfirmAvatarRemove(false);
      setNotice('Profile photo removed.');
    } catch (avatarError) {
      setError(normalizeApiError(avatarError, 'Could not remove profile photo.').message);
    } finally {
      setAvatarUploading(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('This browser does not support location detection. Enter your location manually.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = Number(position.coords.latitude.toFixed(6));
        const longitude = Number(position.coords.longitude.toFixed(6));
        try {
          const geo = await apiService.reverseGeocode(latitude, longitude);
          const suggestion = geo.data || {};
          const next = {
            ...form,
            latitude,
            longitude,
            address: suggestion.displayName || form.address || 'Current browser location',
            city: suggestion.city || form.city,
            district: suggestion.district || form.district,
            state: suggestion.state || form.state,
            locationSource: 'BROWSER',
            clearLocation: false,
          };
          setForm(next);
          const response = await apiService.updateProfile(next);
          updateUser?.(response.data || next);
          setNotice('Current location saved for nearby matching.');
        } catch (locationError) {
          setForm((current) => ({
          ...current,
            latitude,
            longitude,
          locationSource: 'BROWSER',
          clearLocation: false,
          address: current.address || 'Current browser location',
        }));
          setError(normalizeApiError(locationError, 'Location found, but the readable address could not be saved. Try Save profile.').message);
        }
        setLocating(false);
      },
      (geoError) => {
        setLocating(false);
        const denied = geoError?.code === 1 || geoError?.code === geoError?.PERMISSION_DENIED || /denied/i.test(String(geoError?.message || ''));
        const messages = {
          1: 'Location permission was denied. Allow location access or enter your area manually.',
          2: 'Your browser could not determine the current location. Try again or enter it manually.',
          3: 'Location lookup timed out. Try again or enter your area manually.',
        };
        setError(denied ? messages[1] : (messages[geoError?.code] || 'Location is unavailable in this browser. Enter your area manually.'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function clearLocation() {
    setForm((current) => ({
      ...current,
      latitude: null,
      longitude: null,
      locationSource: 'UNKNOWN',
      clearLocation: true,
    }));
    setConfirmClear(false);
    setNotice('Saved precise location will be cleared when you save.');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        bio: form.bio.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        district: form.district.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
      };
      const response = await apiService.updateProfile(payload);
      updateUser?.(response.data || payload);
      setNotice('Profile saved.');
      window.setTimeout(() => navigate('/profile'), 650);
    } catch (saveError) {
      setError(normalizeApiError(saveError, 'Could not save profile updates.').message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-in p7d-page p7d-narrow">
        <Skeleton lines={10} />
      </div>
    );
  }

  return (
    <div className="animate-in p7d-page p7d-narrow">
      <PageHeader
        eyebrow="Profile"
        title="Edit profile"
        description="Update your public profile and matching location."
        action={<Button type="button" variant="secondary" onClick={() => navigate('/profile')}><ArrowLeft size={16} /> Back</Button>}
      />

      {error && <ErrorState message={error} onRetry={loadProfile} />}
      {notice && <Alert variant="success" title="Saved state">{notice}</Alert>}

      <form className="p7d-form" onSubmit={handleSubmit}>
        <Card className="p7d-edit-main-card">
          <div className="p7d-basic-details">
            <SectionHeader title="Basic details" description="Keep your profile details current." />
            <div className="p7d-form-grid p7d-basic-grid">
            <FormField label="Display name" error={fieldErrors.fullName}>
              <Input value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} required />
            </FormField>
            <FormField label="Phone" error={fieldErrors.phone} hint="Optional. Used for contact coordination when needed.">
              <Input type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="+91..." />
            </FormField>
            <FormField label="Bio" error={fieldErrors.bio}>
              <Textarea rows={4} value={form.bio} onChange={(event) => updateField('bio', event.target.value)} maxLength={500} />
            </FormField>
            </div>
          </div>

          <div className="p7d-avatar-card">
            <SectionHeader title="Profile photo" description="JPG, PNG, or WebP. Max 2 MB." />
            <Avatar name={form.fullName || user?.fullName || user?.email} src={avatarUrl} size="xl" />
            <input id="profile-avatar-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatar} hidden />
            <div className="p7d-avatar-actions">
              <Button type="button" variant="secondary" onClick={() => document.getElementById('profile-avatar-file')?.click()}>
                <ImagePlus size={16} /> {avatarUrl ? 'Change photo' : 'Upload photo'}
              </Button>
              {avatarFile && <Button type="button" loading={avatarUploading} onClick={uploadAvatar}><Upload size={16} /> Upload photo</Button>}
              {avatarUrl && <Button type="button" variant="danger" loading={avatarUploading} onClick={() => setConfirmAvatarRemove(true)}><Trash2 size={16} /> Remove photo</Button>}
            </div>
            {avatarFile && <p className="p7d-muted">{avatarFile.name}</p>}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Location" description="Your precise location is kept private." />
          <div className="p7d-location-panel">
            <div>
              <strong>{locationLabel}</strong>
              <p>Source: {form.clearLocation ? 'Will clear on save' : form.locationSource.replace(/_/g, ' ')}</p>
            </div>
            <div className="p7d-action-row">
              <Button type="button" variant="secondary" loading={locating} onClick={useCurrentLocation}><LocateFixed size={16} /> Use current location</Button>
              <Button type="button" variant="danger" onClick={() => setConfirmClear(true)}><Trash2 size={16} /> Clear</Button>
            </div>
          </div>

          <div className="p7d-form-grid">
            <FormField label="Address">
              <LocationAutocompleteInput className="ui-input" value={form.address} placeholder="Search address or area" type="PLACE" onValueChange={(value) => updateField('address', value)} onSuggestionSelect={applyLocationSuggestion} />
            </FormField>
            <FormField label="City">
              <LocationAutocompleteInput className="ui-input" value={form.city} placeholder="City" type="CITY" onValueChange={(value) => updateField('city', value)} onSuggestionSelect={applyLocationSuggestion} />
            </FormField>
            <FormField label="District">
              <LocationAutocompleteInput className="ui-input" value={form.district} placeholder="District" type="DISTRICT" onValueChange={(value) => updateField('district', value)} onSuggestionSelect={applyLocationSuggestion} />
            </FormField>
            <FormField label="State">
              <LocationAutocompleteInput className="ui-input" value={form.state} placeholder="State" type="STATE" onValueChange={(value) => updateField('state', value)} onSuggestionSelect={applyLocationSuggestion} />
            </FormField>
            <FormField label="Postal code" error={fieldErrors.postalCode}>
              <Input value={form.postalCode} onChange={(event) => updateField('postalCode', event.target.value)} />
            </FormField>
          </div>

          <div className="p7d-form-actions">
            <Button type="button" variant="secondary" onClick={() => navigate('/profile')}>Cancel</Button>
            <Button type="submit" loading={saving}><Save size={16} /> Save profile</Button>
          </div>
        </Card>
      </form>

      <ConfirmationDialog
        open={confirmClear}
        title="Clear saved location?"
        message="This removes your saved precise location after you save. Nearby matching may be less accurate until you add a new location."
        confirmLabel="Clear location"
        destructive
        onClose={() => setConfirmClear(false)}
        onConfirm={clearLocation}
      />
      <ConfirmationDialog
        open={confirmAvatarRemove}
        title="Remove profile photo?"
        message="Your initials will be shown until you upload another photo."
        confirmLabel="Remove photo"
        destructive
        loading={avatarUploading}
        onClose={() => setConfirmAvatarRemove(false)}
        onConfirm={removeAvatar}
      />
    </div>
  );
}
