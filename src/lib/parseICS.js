function parseICSDateTime(keyStr, valStr) {
  const v = valStr.trim();
  const isDateOnly = keyStr.includes('VALUE=DATE') || /^\d{8}$/.test(v);

  if (isDateOnly) {
    const y  = v.slice(0, 4);
    const mo = v.slice(4, 6);
    const d  = v.slice(6, 8);
    return { iso: `${y}-${mo}-${d}T00:00:00Z`, allDay: true };
  }

  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (m) {
    // Always emit with Z — treat floating times as-is (no-shift policy)
    return { iso: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`, allDay: false };
  }
  return null;
}

/**
 * Parse .ics text and return an array of event objects, each ready to be
 * created via POST /api/unavailability (the main unavailability route).
 * Preserves full timestamps, event titles, and UIDs.
 */
export function parseICSEvents(text) {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let inEvent = false;
  let cur = {};

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true; cur = {};
    } else if (line === 'END:VEVENT') {
      inEvent = false;
      if (!cur.startRaw) continue;
      const startParsed = parseICSDateTime(cur.startRaw.key, cur.startRaw.val);
      if (!startParsed) continue;

      let endIso = startParsed.iso;
      let allDay = startParsed.allDay;

      if (cur.endRaw) {
        const endParsed = parseICSDateTime(cur.endRaw.key, cur.endRaw.val);
        if (endParsed) {
          if (endParsed.allDay) {
            // ICS all-day DTEND is exclusive midnight — store as 23:59:59 of the previous day
            const d = new Date(endParsed.iso);
            d.setUTCSeconds(d.getUTCSeconds() - 1);
            endIso = d.toISOString().replace(/\.\d{3}Z$/, 'Z');
          } else {
            endIso = endParsed.iso;
          }
          allDay = allDay && endParsed.allDay;
        }
      }

      events.push({
        uid:      cur.uid   || null,
        title:    cur.title || 'Unavailable',
        start_at: startParsed.iso,
        end_at:   endIso,
        all_day:  allDay,
      });
    } else if (inEvent) {
      const ci = line.indexOf(':');
      if (ci === -1) continue;
      const key = line.slice(0, ci);
      const val = line.slice(ci + 1);
      if (key === 'DTSTART' || key.startsWith('DTSTART;')) cur.startRaw = { key, val };
      else if (key === 'DTEND'    || key.startsWith('DTEND;'))    cur.endRaw  = { key, val };
      else if (key === 'SUMMARY') cur.title = val.replace(/\\,/g, ',').replace(/\\n/g, '\n').trim();
      else if (key === 'UID')     cur.uid   = val.trim();
    }
  }

  return events;
}
