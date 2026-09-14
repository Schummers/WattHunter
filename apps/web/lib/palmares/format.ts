/**
 * Name shortening for the palmares tables.
 *
 * An explicit rule, never a CSS ellipsis: a column that clips at its own width
 * produces a different name on every screen size, and "David Chonc…" reads as a
 * bug. Here the same name always shortens the same way.
 *
 * The rule is deliberately dictionary-free — initial the first word, keep the
 * rest — because nothing in a display name says which half is the first name.
 */
const SHORT_TAIL = 6;
const SHORT_MONONYM = 9;
/** Clipping only earns its ugliness when it actually saves room. */
const MIN_CLIP_GAIN = 3;

export function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const [first, ...rest] = parts;
  return `${first[0].toUpperCase()}. ${rest.join(" ")}`;
}

/** Tighter form, for the three narrow columns of a season card. */
export function abbreviateNameShort(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) {
    return name.length - SHORT_MONONYM >= MIN_CLIP_GAIN ? name.slice(0, SHORT_MONONYM) : name;
  }
  const [first, ...rest] = parts;
  const tail = rest.join(" ");
  const shortTail = tail.length > SHORT_TAIL + 1 ? `${tail.slice(0, SHORT_TAIL)}.` : tail;
  return `${first[0].toUpperCase()}. ${shortTail}`;
}

/** `9‑4`, with a non-breaking hyphen so a score never wraps mid-way. */
export function formatHeadToHeadScore(ahead: number, behind: number): string {
  return `${ahead}‑${behind}`;
}
