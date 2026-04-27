/** True if `pathname` is already under the same nav target as `href` (no transition needed). */
export function isSameNavTarget(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  const base = href.endsWith("/") ? href.slice(0, -1) : href;
  if (base === "") return false;
  return pathname.startsWith(`${base}/`);
}
