import { useState, useRef, useEffect } from 'react';

export default function ShareDropdown({ request }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef(null);

  const shareUrl = `${window.location.origin}/public/request/${request.id}`;
  const shareText = `Need help! ${request.title} at ${request.address || 'nearby'}. Help here: ${shareUrl}`;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy!', err);
    }
  };

  const shareToWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="share-dropdown-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        title="Share request"
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          background: isOpen ? 'var(--accent-primary)' : 'var(--bg-secondary)',
          color: isOpen ? 'white' : 'var(--text-primary)',
          transition: 'all 0.2s ease'
        }}
      >
        🔗
      </button>

      {isOpen && (
        <div className="animate-in" style={{
          position: 'absolute',
          top: '100%',
          right: '0',
          marginTop: '8px',
          width: '240px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color)',
          zIndex: 100,
          overflow: 'hidden',
          padding: '8px'
        }}>
          <button
            className="dropdown-item"
            onClick={copyToClipboard}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              borderRadius: '8px',
              fontSize: '0.9rem',
              textAlign: 'left',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => e.target.style.background = 'var(--bg-secondary)'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            <span style={{ fontSize: '1.2rem' }}>{copied ? '✅' : '📋'}</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600 }}>{copied ? 'Copied!' : 'Copy Link'}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Public shareable URL</span>
            </div>
          </button>

          <button
            className="dropdown-item"
            onClick={shareToWhatsApp}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              borderRadius: '8px',
              fontSize: '0.9rem',
              textAlign: 'left',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => e.target.style.background = 'var(--bg-secondary)'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            <span style={{ fontSize: '1.2rem' }}>💚</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600 }}>WhatsApp</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Share with contacts</span>
            </div>
          </button>

          <button
            className="dropdown-item"
            onClick={shareToTwitter}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              padding: '12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              borderRadius: '8px',
              fontSize: '0.9rem',
              textAlign: 'left',
              transition: 'background 0.2s ease'
            }}
            onMouseOver={(e) => e.target.style.background = 'var(--bg-secondary)'}
            onMouseOut={(e) => e.target.style.background = 'transparent'}
          >
            <span style={{ fontSize: '1.2rem' }}>𝕏</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600 }}>Twitter / X</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Post to timeline</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
