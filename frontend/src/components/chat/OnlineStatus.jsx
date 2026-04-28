function formatLastSeen(lastSeen) {
  if (!lastSeen) return 'Offline';

  const diff = Math.max(1, Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000));
  if (diff < 60) return `Active ${diff}m ago`;

  const hours = Math.floor(diff / 60);
  if (hours < 24) return `Active ${hours}h ago`;

  return `Active ${Math.floor(hours / 24)}d ago`;
}

export default function OnlineStatus({ presence, compact = false }) {
  const status = String(presence?.status || 'OFFLINE').toUpperCase();
  const isOnline = status === 'ONLINE' || status === 'AWAY';

  if (compact) {
    return (
      <div className={`presence-indicator ${isOnline ? 'online' : 'offline'}`} />
    );
  }

  return (
    <div className="chat-online-status">
      <div className={`presence-indicator ${isOnline ? 'online' : 'offline'}`} />
      <span>{isOnline ? 'Active now' : formatLastSeen(presence?.lastSeen)}</span>
    </div>
  );
}
