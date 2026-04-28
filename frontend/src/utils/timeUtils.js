/**
 * Shared time formatting utilities for HVHN.
 */

/**
 * Returns a human-readable relative time string (e.g., "5m ago", "2h ago").
 * @param {string|Date} dateStr - ISO date string or Date object.
 * @returns {string} Relative time string.
 */
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Formats a date string to a compact locale string.
 * @param {string|Date} dateStr - ISO date string or Date object.
 * @returns {string} Formatted date string.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}
