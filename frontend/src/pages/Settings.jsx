import { useAccessibility } from '../context/AccessibilityContext';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { 
    isDyslexic, toggleDyslexia, 
    isHighContrast, toggleHighContrast, 
    isLargeText, toggleLargeText 
  } = useAccessibility();
  const navigate = useNavigate();

  return (
    <div className="animate-in">
      <button 
        className="btn btn-secondary btn-sm" 
        onClick={() => navigate(-1)} 
        style={{ marginBottom: '20px' }}
      >
        ← Back
      </button>

      <div className="page-header">
        <div>
          <h1>⚙️ Settings</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
            Personalize your experience and configure accessibility options.
          </p>
        </div>
      </div>

      <div className="settings-content" style={{ display: 'grid', gap: '24px', maxWidth: '800px' }}>
        {/* Accessibility Section */}
        <div className="card">
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            ♿ Accessibility
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            We want HVHN to be usable by everyone. Use these settings to adjust the interface to your needs.
          </p>

          <div style={{ display: 'grid', gap: '16px' }}>
            {/* Dyslexia Mode */}
            <div className="setting-item" style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px'
            }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>Dyslexia Friendly Font</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Switch to OpenDyslexic font and increase spacing for better readability.
                </div>
              </div>
              <button 
                className={`sidebar-availability-toggle ${isDyslexic ? 'active' : ''}`}
                onClick={toggleDyslexia}
              >
                <span />
              </button>
            </div>

            {/* High Contrast Mode */}
            <div className="setting-item" style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px'
            }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>High Contrast Mode</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Use pure black and white colors to increase text visibility.
                </div>
              </div>
              <button 
                className={`sidebar-availability-toggle ${isHighContrast ? 'active' : ''}`}
                onClick={toggleHighContrast}
              >
                <span />
              </button>
            </div>

            {/* Large Text Mode */}
            <div className="setting-item" style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px'
            }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: '4px' }}>Large Text Mode</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Scale up font sizes by 20% across the entire application.
                </div>
              </div>
              <button 
                className={`sidebar-availability-toggle ${isLargeText ? 'active' : ''}`}
                onClick={toggleLargeText}
              >
                <span />
              </button>
            </div>
          </div>
        </div>

        {/* General Info Section */}
        <div className="card" style={{ opacity: 0.8 }}>
          <h3 style={{ marginBottom: '16px' }}>📱 App Info</h3>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <p><strong>Version:</strong> 1.2.0-stable</p>
            <p><strong>Platform:</strong> HVHN Web (Advanced Layer)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
