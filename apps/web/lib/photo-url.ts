/**
 * Resolve a rider photo URL.
 *
 * Rider photos are self-hosted in Supabase Storage (`riders.photo_url` holds a full
 * Supabase CDN URL) because procyclingstats.com now blocks direct image hotlinks via
 * Cloudflare. Most consumers render a plain `<img>` (Radix `AvatarImage`), so the value
 * must be an absolute URL.
 *
 * Absolute (http/https) URLs are returned unchanged. Anything else (legacy relative PCS
 * paths, which no longer load) resolves to `undefined` so the avatar falls back to initials.
 */
export function resolvePhotoUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return undefined;
}
