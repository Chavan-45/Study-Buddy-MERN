/**
 * Convert 24-hour string "HH:mm" to 12-hour AM/PM display string "h:mm AM/PM".
 * e.g. "16:00" -> "4:00 PM", "00:30" -> "12:30 AM", "12:00" -> "12:00 PM", "13:15" -> "1:15 PM"
 */
export function formatTime12Hour(time24) {
  if (!time24 || typeof time24 !== 'string') return '';
  const parts = time24.split(':');
  if (parts.length < 2) return time24;

  let hour = parseInt(parts[0], 10);
  const minute = parts[1] || '00';
  if (isNaN(hour)) return time24;

  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${period}`;
}

/**
 * Convert 12-hour parts (hour: 1-12, minute: "00", period: "AM"/"PM") to 24-hour string "HH:mm".
 * e.g. (4, "00", "PM") -> "16:00"
 * (12, "00", "AM") -> "00:00"
 * (12, "00", "PM") -> "12:00"
 * (1, "15", "PM") -> "13:15"
 */
export function convert12To24(hour, minute, period) {
  let h = parseInt(hour, 10);
  if (isNaN(h)) h = 12;
  const m = minute || '00';
  const p = (period || 'AM').toUpperCase();

  if (p === 'PM') {
    if (h < 12) h += 12;
  } else {
    if (h === 12) h = 0;
  }

  const hStr = String(h).padStart(2, '0');
  return `${hStr}:${m}`;
}

/**
 * Convert 24-hour string "HH:mm" to 12-hour parts { hour: "1"-"12", minute: "00"|"15"|"30"|"45", period: "AM"|"PM" }.
 * e.g. "16:00" -> { hour: "4", minute: "00", period: "PM" }
 */
export function convert24To12Parts(time24) {
  if (!time24 || typeof time24 !== 'string') {
    return { hour: '4', minute: '00', period: 'PM' };
  }
  const parts = time24.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  if (isNaN(h)) h = 12;

  const period = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12 || 12;

  let minSnap = m;
  const mNum = parseInt(m, 10);
  if (!isNaN(mNum)) {
    if (mNum < 8) minSnap = '00';
    else if (mNum < 23) minSnap = '15';
    else if (mNum < 38) minSnap = '30';
    else if (mNum < 53) minSnap = '45';
    else minSnap = '00';
  }

  return {
    hour: String(hour12),
    minute: minSnap,
    period
  };
}
