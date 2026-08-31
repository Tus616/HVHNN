export function normalizeApiError(error, fallback = 'Something went wrong. Please try again.') {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const requestId = data?.requestId || data?.traceId || error?.requestId || '';
  const fieldErrors = data?.fieldErrors || data?.errors || {};

  let message = data?.message || data?.error || error?.message || fallback;

  if (status === 400) message = message || 'Check the highlighted fields and try again.';
  if (status === 401) message = 'Your session expired. Please log in again.';
  if (status === 403) message = 'You do not have permission to do that.';
  if (status === 404) message = 'We could not find that resource.';
  if (status === 409) message = 'This was already changed by someone else. Refresh and try again.';
  if (status === 422) message = message || 'That action is not available for this item right now.';
  if (status === 429) message = 'Too many attempts. Please wait a moment and try again.';
  if (status >= 500) message = 'The server had trouble completing this. Please try again shortly.';

  if (/exception|stack trace|java\.|sql|mongodb|jwt token/i.test(String(message))) {
    message = fallback;
  }

  return {
    status: status || 0,
    message,
    requestId,
    fieldErrors,
  };
}

export function safeInternalPath(path, fallback = '/') {
  if (!path || typeof path !== 'string') return fallback;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.toLowerCase().startsWith('javascript:')) {
    return fallback;
  }
  return trimmed;
}
