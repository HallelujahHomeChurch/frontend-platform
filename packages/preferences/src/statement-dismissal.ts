type StatementRef = {statementId: string; publishedVersion: number}
const cookieName = 'hhc_statement_dismissed'
const storageKey = (ref: StatementRef) => `hhc:statement:${ref.statementId}:dismissed-version`
const valid = (ref: StatementRef) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(ref.statementId) && Number.isSafeInteger(ref.publishedVersion) && ref.publishedVersion > 0
export const statementRefKey = (ref: StatementRef): string => `${ref.statementId}.${ref.publishedVersion}`
function share(ref: StatementRef): boolean {
  if (typeof document === 'undefined' || typeof location === 'undefined') return false
  try {
    const domain = location.hostname === 'alive.org.tw' || location.hostname.endsWith('.alive.org.tw') ? '; Domain=alive.org.tw' : ''
    document.cookie = `${cookieName}=${statementRefKey(ref)}; Path=/; Max-Age=34560000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}${domain}`
    return document.cookie.split(/;\s*/).includes(`${cookieName}=${statementRefKey(ref)}`)
  } catch {return false}
}
export function readAnonymousStatementDismissal(ref: StatementRef): boolean {
  if (!valid(ref)) return false
  let hidden = false
  try {hidden = typeof document !== 'undefined' && document.cookie.split(/;\s*/).includes(`${cookieName}=${statementRefKey(ref)}`)} catch { /* Reading remains available without cookies. */ }
  try {
    if (hidden) localStorage.setItem(storageKey(ref), String(ref.publishedVersion))
    else if (localStorage.getItem(storageKey(ref)) === String(ref.publishedVersion)) {hidden = true; share(ref)}
  } catch { /* Cookie-only storage remains available. */ }
  return hidden
}
export function writeAnonymousStatementDismissal(ref: StatementRef): boolean {
  if (!valid(ref)) return false
  let saved = false
  try {localStorage.setItem(storageKey(ref), String(ref.publishedVersion)); saved = localStorage.getItem(storageKey(ref)) === String(ref.publishedVersion)} catch { /* Cookie-only storage remains available. */ }
  return share(ref) || saved
}
