export default function UnreadBadge({ count }) {
  if (!count) return null;
  return <span className="chat-unread-badge">{count > 99 ? '99+' : count}</span>;
}
