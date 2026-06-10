export const fmt = (cents) =>
  cents != null ? `$${(Number(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';

export const fmtDate = (d) =>
  d ? new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString() : '—';
