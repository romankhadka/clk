// Detect the locale's hour cycle once, then build display slots ourselves so
// the glyph set stays 0-9 and ':' in every locale and numbering system.
const hourCycle: string = (() => {
  try {
    return (
      new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle ?? 'h23'
    );
  } catch {
    return 'h23';
  }
})();

export function timeSlots(d: Date): string {
  let h = d.getHours();
  switch (hourCycle) {
    case 'h11':
      h = h % 12;
      break;
    case 'h12':
      h = ((h + 11) % 12) + 1;
      break;
    case 'h24':
      h = h === 0 ? 24 : h;
      break;
    // h23: as-is
  }
  const pad = hourCycle === 'h23' || hourCycle === 'h24';
  const hs = pad ? String(h).padStart(2, '0') : String(h);
  return `${hs}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function timeZoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'LOCAL TIME';
  } catch {
    return 'LOCAL TIME';
  }
}
