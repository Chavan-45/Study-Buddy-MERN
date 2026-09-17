/**
 * Format a timestamp into user-friendly relative time (e.g. "Just now", "2 min ago", "1 hr ago", "Yesterday")
 */
export function formatRelativeTime(createdAt) {
  if (!createdAt) return 'Just now';

  let dateObj = null;
  if (createdAt.seconds) {
    dateObj = new Date(createdAt.seconds * 1000);
  } else if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    dateObj = new Date(createdAt);
  } else if (createdAt instanceof Date) {
    dateObj = createdAt;
  }

  if (!dateObj || isNaN(dateObj.getTime())) return 'Just now';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffInSeconds < 30) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} min ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hr${diffInHours > 1 ? 's' : ''} ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;

  // Standard short date
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;
}
