import { getVolunteerBadges } from '../../utils/volunteer';

export default function VolunteerBadgeList({ totalHelpCount = 0, emptyMessage = 'No badges yet' }) {
  const badges = getVolunteerBadges(totalHelpCount);

  if (badges.length === 0) {
    return <div className="volunteer-empty-inline">{emptyMessage}</div>;
  }

  return (
    <div className="volunteer-badge-row">
      {badges.map((badge) => (
        <span key={badge.key} className="volunteer-badge-pill">
          <span aria-hidden="true">{badge.icon}</span>
          <span>{badge.label}</span>
        </span>
      ))}
    </div>
  );
}
