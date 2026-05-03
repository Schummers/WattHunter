/**
 * Resolve a rider photo URL.
 *
 * The PCS scraper stores rider photos as relative paths like
 * `images/riders/vg/em/ben-tulett-2026-n2-n3.jpg`. We prefix them with
 * the procyclingstats.com origin so they can be loaded by `next/image`
 * (which rejects paths without a leading slash or absolute URL).
 *
 * Already-absolute URLs are returned unchanged.
 */
export function resolvePhotoUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return `https://www.procyclingstats.com/${url}`;
}
