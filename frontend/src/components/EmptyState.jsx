import { Link } from 'react-router-dom';
import { Search, MapPin, MessageSquare, Users } from 'lucide-react';

const ILLUSTRATIONS = {
  requests: <MapPin size={48} strokeWidth={1.5} />,
  messages: <MessageSquare size={48} strokeWidth={1.5} />,
  communities: <Users size={48} strokeWidth={1.5} />,
  search: <Search size={48} strokeWidth={1.5} />,
};

export default function EmptyState({ 
  type = 'requests', 
  title, 
  message, 
  image,
  actionLabel, 
  actionLink,
  onAction 
}) {
  return (
    <div className="empty-state-card animate-in fade-in zoom-in-95 duration-500">
      <div className="empty-state-illustration">
        {image ? (
          <img src={image} alt="" className="empty-state-image" />
        ) : (
          <>
            <div className="illustration-blob" />
            {ILLUSTRATIONS[type] || ILLUSTRATIONS.requests}
          </>
        )}
      </div>

      
      <h3 className="empty-state-title">{title || 'Nothing here yet'}</h3>
      <p className="empty-state-message">
        {message || 'No data found in this category. Check back soon or try another filter!'}
      </p>

      {(actionLabel && (actionLink || onAction)) && (
        actionLink ? (
          <Link to={actionLink} className="btn btn-primary mt-4">
            {actionLabel}
          </Link>
        ) : (
          <button onClick={onAction} className="btn btn-primary mt-4">
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
}
