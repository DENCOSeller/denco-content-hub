export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function setCookie(name: string, value: string, days = 7): void {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`
}

export function setRawCookie(name: string, value: string, days = 7): void {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${value}; path=/; expires=${expires}; SameSite=Lax`
}

export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}
