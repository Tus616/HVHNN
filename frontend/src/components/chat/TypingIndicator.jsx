function formatTypingText(users) {
  if (!users.length) return '';
  if (users.length === 1) return `${users[0].fullName} is typing...`;
  if (users.length === 2) return `${users[0].fullName} and ${users[1].fullName} are typing...`;
  return `${users[0].fullName}, ${users[1].fullName}, and others are typing...`;
}

export default function TypingIndicator({ users = [] }) {
  if (!users.length) return null;

  return (
    <div className="chat-typing-indicator">
      <span>{formatTypingText(users)}</span>
      <span className="chat-typing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
