import { useEffect, useRef, useState } from 'react';
import { SendHorizonal, Smile, X } from 'lucide-react';
import { IconButton } from '../ui';

const QUICK_REACTIONS = ['👍', '❤️', '🙂', '🙏'];

export default function ChatInput({
  disabled,
  onSend,
  onTypingChange,
  prefillText = '',
}) {
  const [draft, setDraft] = useState('');
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const textareaRef = useRef(null);
  const idleTimerRef = useRef(null);
  const sendingRef = useRef(false);

  useEffect(() => () => {
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
  }, []);

  useEffect(() => {
    if (!prefillText) return;
    setDraft(prefillText);
    resetTypingTimer(prefillText);
    textareaRef.current?.focus();
  }, [prefillText]);

  function resetTypingTimer(nextDraft) {
    onTypingChange?.(Boolean(nextDraft.trim()));
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => onTypingChange?.(false), 2200);
  }

  function updateDraft(nextDraft) {
    setDraft(nextDraft);
    resetTypingTimer(nextDraft);
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
  }

  async function handleSend() {
    const content = draft.trim();
    if (disabled || !content || sendingRef.current) return;
    sendingRef.current = true;
    const didSend = await onSend(content);
    sendingRef.current = false;
    if (didSend) {
      setDraft('');
      setShowEmojiTray(false);
      onTypingChange?.(false);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  const canSend = Boolean(draft.trim()) && !disabled;

  return (
    <div className="p7c-composer" aria-label="Message composer">
      {showEmojiTray && (
        <div className="p7c-emoji-tray" role="menu" aria-label="Quick emoji reactions">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`Insert ${emoji}`}
              onClick={() => updateDraft(`${draft}${emoji}`)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className={`p7c-composer-box ${disabled ? 'is-disabled' : ''}`}>
        <IconButton
          label={showEmojiTray ? 'Close emoji choices' : 'Open emoji choices'}
          className="p7c-composer-icon"
          onClick={() => setShowEmojiTray((current) => !current)}
          disabled={disabled}
        >
          {showEmojiTray ? <X size={18} /> : <Smile size={18} />}
        </IconButton>

        <label className="sr-only" htmlFor="chat-message-composer">Message</label>
        <textarea
          id="chat-message-composer"
          ref={textareaRef}
          rows={1}
          placeholder={disabled ? 'Reconnect to send messages' : 'Write a message'}
          value={draft}
          onChange={(event) => updateDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />

        <button
          type="button"
          className="p7c-send-button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
        >
          <SendHorizonal size={18} aria-hidden="true" />
          <span>Send</span>
        </button>
      </div>
    </div>
  );
}
