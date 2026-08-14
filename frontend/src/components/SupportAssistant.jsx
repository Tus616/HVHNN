import { useMemo, useRef, useState } from 'react';
import { Bot, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';
import { IconButton } from './ui';

function pageName(pathname) {
  if (pathname.startsWith('/request/')) return 'Request detail';
  if (pathname === '/create') return 'Raise request';
  if (pathname === '/feed') return 'Help Feed';
  if (pathname === '/notifications') return 'Notifications';
  if (pathname.startsWith('/profile')) return 'Profile';
  if (pathname.startsWith('/communities') || pathname.startsWith('/community/')) return 'Communities';
  return 'Sahay';
}

export default function SupportAssistant({ open, onClose }) {
  const { user } = useAuth();
  const location = useLocation();
  const inputRef = useRef(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi. Ask me about requests, volunteering, communities, location, notifications, or your profile.' },
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastPayload, setLastPayload] = useState(null);
  const currentPage = useMemo(() => pageName(location.pathname), [location.pathname]);

  async function sendMessage(text = draft) {
    const message = text.trim();
    if (!message || loading) return;
    const nextMessages = [...messages, { role: 'user', text: message }];
    setMessages(nextMessages);
    setDraft('');
    setLoading(true);
    const payload = {
      message,
      history: nextMessages.slice(-8).map(({ role, text: value }) => ({ role, message: value })),
      route: location.pathname,
      pageName: currentPage,
      userContext: {
        signedIn: Boolean(user),
        verified: Boolean(user?.verified),
        isVolunteer: Boolean(user?.isVolunteer),
        onboardingCompleted: Boolean(user?.onboardingCompleted),
      },
    };
    setLastPayload(payload);
    try {
      const response = await apiService.sendAssistantMessage(payload);
      setMessages((current) => [...current, { role: 'assistant', text: response.data?.reply || 'I can help with Sahay workflows, but I could not form a full reply.' }]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', text: 'I could not reach the assistant service. Try again, or ask about raising requests, volunteering, location, profile, or notifications.' }]);
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function retry() {
    if (lastPayload?.message) sendMessage(lastPayload.message);
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  if (!open) return null;

  return (
    <aside className="hv-assistant-panel" aria-label="Sahay Assistant">
      <header>
        <span><Bot size={18} /> Sahay Assistant</span>
        <IconButton label="Close assistant" onClick={onClose}><X size={17} /></IconButton>
      </header>
      <div className="hv-assistant-messages" role="log" aria-live="polite">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`hv-assistant-msg is-${message.role}`}>
            {message.text}
          </div>
        ))}
        {loading && <div className="hv-assistant-msg is-assistant">Typing...</div>}
      </div>
      <footer>
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for help..."
          rows={2}
        />
        <div>
          <IconButton label="Clear conversation" onClick={() => setMessages([{ role: 'assistant', text: 'Conversation cleared. What would you like help with?' }])}>
            <Trash2 size={16} />
          </IconButton>
          <IconButton label="Retry last message" onClick={retry} disabled={!lastPayload || loading}>
            <RotateCcw size={16} />
          </IconButton>
          <IconButton label="Send message" onClick={() => sendMessage()} disabled={!draft.trim() || loading}>
            <Send size={16} />
          </IconButton>
        </div>
      </footer>
    </aside>
  );
}
