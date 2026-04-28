export default function ConnectionBanner({ status }) {
  if (status === 'reconnecting') {
    return <div className="chat-connection-banner chat-connection-banner-warning">Reconnecting...</div>;
  }

  if (status === 'connected') {
    return <div className="chat-connection-banner chat-connection-banner-success">Connected</div>;
  }

  return null;
}
