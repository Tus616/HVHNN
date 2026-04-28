import { formatVolunteerProgressStatus } from '../../utils/volunteer';

const STATUS_FLOW = {
  ASSIGNED: 'ON_THE_WAY',
  ON_THE_WAY: 'REACHED',
  REACHED: 'COMPLETED',
};

const STEPS = ['ASSIGNED', 'ON_THE_WAY', 'REACHED', 'COMPLETED'];

export default function VolunteerStatusActions({ request, onUpdate, loading = false }) {
  const currentStatus = request?.volunteerProgressStatus || 'ASSIGNED';
  const nextStatus = STATUS_FLOW[currentStatus];
  const currentIndex = STEPS.indexOf(currentStatus);

  if (!request || request.status === 'COMPLETED') {
    return null;
  }

  const buttonLabel = nextStatus === 'COMPLETED'
    ? 'Mark Complete'
    : nextStatus ? formatVolunteerProgressStatus(nextStatus) : null;

  return (
    <div className="volunteer-status-container" style={{ marginTop: '16px' }}>
      <div className="volunteer-stepper" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', position: 'relative' }}>
        <div className="stepper-line" style={{ position: 'absolute', top: '10px', left: '0', right: '0', height: '2px', background: 'var(--bg-secondary)', zIndex: 0 }} />
        <div className="stepper-line-active" style={{ position: 'absolute', top: '10px', left: '0', width: `${(currentIndex / (STEPS.length - 1)) * 100}%`, height: '2px', background: 'var(--accent-primary)', zIndex: 0, transition: 'width 0.3s ease' }} />
        
        {STEPS.map((step, idx) => (
          <div key={step} className="step-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: '4px' }}>
            <div className="step-dot" style={{ 
              width: '20px', height: '20px', borderRadius: '50%', 
              background: idx <= currentIndex ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              border: '2px solid var(--bg-card)',
              transition: 'background 0.3s ease'
            }} />
            <span style={{ fontSize: '0.65rem', color: idx <= currentIndex ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {formatVolunteerProgressStatus(step)}
            </span>
          </div>
        ))}
      </div>

      {nextStatus && (
        <button
          type="button"
          className={nextStatus === 'COMPLETED' ? 'btn btn-success' : 'btn btn-primary'}
          onClick={() => onUpdate(nextStatus)}
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {loading ? 'Saving Progress...' : `Next: ${buttonLabel}`}
        </button>
      )}
    </div>
  );
}
