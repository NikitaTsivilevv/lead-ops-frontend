export const DAYS = [
  { dow: 1, label: 'Monday' },
  { dow: 2, label: 'Tuesday' },
  { dow: 3, label: 'Wednesday' },
  { dow: 4, label: 'Thursday' },
  { dow: 5, label: 'Friday' },
  { dow: 6, label: 'Saturday' },
  { dow: 0, label: 'Sunday' },
];

export function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function fromYMD(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function fmtBlocked(ymd) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(fromYMD(ymd));
}
export function emptySlot() {
  return { start_time: '09:00', end_time: '17:00', capacity: 1, _key: Math.random() };
}
export function emptySpecific() {
  return { specific_date: '', start_time: '09:00', end_time: '17:00', capacity: 1, _key: Math.random() };
}
export function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
export function stripKeys(arr) { return arr.map(({ _key, ...rest }) => rest); }
export function addKeys(arr) { return (arr || []).map(item => ({ ...item, _key: Math.random() })); }

export function validate(recurring, specific) {
  const errors = [];
  recurring.forEach((slot) => {
    if (!slot.start_time || !slot.end_time) return;
    if (slot.start_time >= slot.end_time) {
      const day = DAYS.find(d => d.dow === slot.day_of_week)?.label || `Day ${slot.day_of_week}`;
      errors.push(`${day}: start time must be before end time (${slot.start_time} – ${slot.end_time}).`);
    }
    if (slot.capacity < 0 || !Number.isInteger(Number(slot.capacity))) {
      const day = DAYS.find(d => d.dow === slot.day_of_week)?.label || `Day ${slot.day_of_week}`;
      errors.push(`${day}: capacity must be a non-negative integer.`);
    }
  });
  specific.forEach((slot, i) => {
    if (!slot.specific_date) errors.push(`Specific date #${i + 1}: date is required.`);
    if (slot.start_time && slot.end_time && slot.start_time >= slot.end_time)
      errors.push(`Specific date ${slot.specific_date || `#${i + 1}`}: start time must be before end time.`);
    if (slot.capacity < 0 || !Number.isInteger(Number(slot.capacity)))
      errors.push(`Specific date ${slot.specific_date || `#${i + 1}`}: capacity must be a non-negative integer.`);
  });
  return errors;
}
