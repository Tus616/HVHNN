import { useEffect, useRef, useState } from 'react';
import { Paperclip, SendHorizonal, Smile } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

export default function ChatInput({
  disabled,
  onSend,
  onTypingChange,
  onUpload,
  prefillText = '',
}) {
  const [draft, setDraft] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  
  const fileInputRef = useRef(null);
  const idleTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (prefillText) {
      setDraft(prefillText);
      resetTypingTimer(prefillText);
    }
  }, [prefillText]);

  function resetTypingTimer(nextDraft) {
    onTypingChange(Boolean(nextDraft.trim()));
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => onTypingChange(false), 2000);
  }

  function handleChange(event) {
    const nextDraft = event.target.value;
    setDraft(nextDraft);
    resetTypingTimer(nextDraft);
  }

  async function handleSend() {
    if (disabled || uploading) return;

    if (pendingFile) {
      setUploading(true);
      try {
        await onUpload(pendingFile);
        setPendingFile(null);
        setPreviewUrl('');
      } finally {
        setUploading(false);
      }
    }

    const nextDraft = draft.trim();
    if (nextDraft) {
      const didSend = onSend(nextDraft);
      if (didSend) {
        setDraft('');
        setShowEmojiPicker(false);
        onTypingChange(false);
      }
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleFileSelect(event) {
    const [file] = event.target.files || [];
    event.target.value = '';
    if (!file || disabled) return;

    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }

  return (
    <div className="chat-input-shell" style={{ position: 'relative' }}>
      {showEmojiPicker && (
        <div className="chat-emoji-picker" style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 100, width: '320px', marginBottom: '12px' }}>
          <EmojiPicker
            width="100%"
            height={400}
            onEmojiClick={(emoji) => {
              const nextDraft = `${draft}${emoji.emoji}`;
              setDraft(nextDraft);
              resetTypingTimer(nextDraft);
            }}
          />
        </div>
      )}

      {pendingFile && (
        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px', animation: 'message-in 0.2s ease-out' }}>
          {previewUrl ? (
            <img src={previewUrl} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} alt="Preview" />
          ) : (
            <div style={{ width: '60px', height: '60px', background: 'var(--bg-card)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📄</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pendingFile.name}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{(pendingFile.size / 1024).toFixed(1)} KB</div>
          </div>
          <button className="btn btn-icon" onClick={() => { setPendingFile(null); setPreviewUrl(''); }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', padding: '8px 16px', gap: '12px' }}>
          <button className="btn btn-icon" onClick={() => fileInputRef.current?.click()} disabled={disabled || uploading} style={{ padding: '8px', margin: 0 }}>
            <Paperclip size={20} opacity={0.5} />
          </button>
          
          <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} />

          <textarea
            className="form-textarea"
            rows={1}
            placeholder={disabled ? 'Reconnect...' : 'Message...'}
            value={draft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || uploading}
            style={{ flex: 1, border: 'none', background: 'transparent', padding: '8px 0', fontSize: '0.95rem', minHeight: '40px', maxHeight: '120px', resize: 'none' }}
          />

          <button className="btn btn-icon" onClick={() => setShowEmojiPicker(!showEmojiPicker)} disabled={disabled} style={{ padding: '8px', margin: 0 }}>
            <Smile size={20} opacity={0.5} />
          </button>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={disabled || uploading || (!draft.trim() && !pendingFile)}
          style={{ width: '48px', height: '48px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <SendHorizonal size={22} />
        </button>
      </div>
    </div>
  );
}
