import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiService from '../services/api';

export default function PublicRequest() {
  const { id } = useParams();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadRequest() {
      try {
        const response = await apiService.getPublicRequest(id);
        setRequest(response.data);
      } catch (err) {
        setError(err.message || 'Request not found.');
      } finally {
        setLoading(false);
      }
    }
    loadRequest();
  }, [id]);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  if (error || !request) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card text-center max-w-md animate-in" style={{ padding: '60px 40px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px', opacity: 0.3 }}>🔍</div>
          <h2 style={{ marginBottom: '10px' }}>Request Not Found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
            {error || 'This request may have expired, been completed, or removed.'}
          </p>
          <Link to="/" className="btn btn-primary" style={{ padding: '12px 32px' }}>
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const urgencyClass = request.urgency?.toLowerCase() || 'medium';

  return (
    <div className="animate-in" style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '40px 20px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-primary)' }}>
            <span style={{ 
              background: 'var(--accent-primary)', 
              color: 'white', 
              width: '36px', 
              height: '36px', 
              borderRadius: '8px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}>⚡</span>
            Sahay
          </Link>
          <Link to="/register" className="btn btn-secondary btn-sm">Join Network</Link>
        </div>

        {/* Request Card */}
        <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ height: '6px', width: '100%', background: `var(--${urgencyClass})` }} />
          
          <div style={{ padding: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <span className={`badge urgency-${urgencyClass}`} style={{ fontSize: '0.75rem', padding: '4px 12px' }}>
                {request.urgency}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {new Date(request.createdAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '20px', lineHeight: 1.2 }}>
              {request.title}
            </h1>
            
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '32px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {request.description}
            </p>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '24px', 
              marginBottom: '40px',
              padding: '24px',
              background: 'var(--bg-secondary)',
              borderRadius: '16px'
            }}>
              <div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>Location</div>
                <div style={{ fontWeight: 600 }}>📍 {request.address}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>Category</div>
                <div style={{ fontWeight: 600 }}>🏷️ {request.category?.replace('_', ' ')}</div>
              </div>
              {request.communityName && (
                <div>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>Community</div>
                  <div style={{ fontWeight: 600 }}>🏘️ {request.communityName}</div>
                </div>
              )}
            </div>

            {/* CTA Section */}
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)', 
              borderRadius: '20px', 
              padding: '32px', 
              textAlign: 'center',
              border: '1px solid rgba(99, 102, 241, 0.2)'
            }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '12px' }}>Can you help with this?</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem' }}>
                Login or create an account to accept this request and securely connect with the requester.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/register" className="btn btn-primary" style={{ padding: '12px 32px' }}>Join Sahay to Help</Link>
                <Link to="/login" className="btn btn-secondary" style={{ padding: '12px 32px' }}>Sign In</Link>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Sahay - Help Where It Matters<br/>
            Bridging communities through verified assistance.
          </p>
        </div>
      </div>
    </div>
  );
}
