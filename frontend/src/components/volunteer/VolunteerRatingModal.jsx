import { useEffect, useState } from 'react';

export default function VolunteerRatingModal({ open, onClose, onSubmit, loading = false, volunteerName = '' }) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (open) {
      setRating(5);
      setFeedback('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal volunteer-rating-modal">
        <h2>Rate Your Volunteer</h2>
        <p className="volunteer-rating-copy">
          Share how {volunteerName || 'your volunteer'} helped so other neighbors know who shows up reliably.
        </p>

        <div className="volunteer-star-row" role="group" aria-label="Choose a rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={`volunteer-star ${value <= rating ? 'active' : ''}`}
              onClick={() => setRating(value)}
              aria-label={`${value} star${value > 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
        </div>

        <div className="form-group">
          <label className="form-label">Feedback</label>
          <textarea
            className="form-textarea"
            rows={4}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            placeholder="Optional note about the help you received"
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Later
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSubmit({ rating, feedback })}
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  );
}
