function normalizeConfiguredDifyBaseUrl(baseUrl: string): string {
  return String(baseUrl || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "")
}

function getPathname(url: string): string | null {
  if (!url) return null

  if (url.startsWith("/")) {
    return url
  }

  try {
    return new URL(url).pathname
  } catch {
    return null
  }
}

export function shouldProxyDifyImageUrl(url: string): boolean {
  const pathname = getPathname(url)
  if (!pathname) return false

  return pathname.startsWith("/files/") || pathname.includes("/files/")
}

export function resolveAllowedDifyImageUrl(url: string, configuredBaseUrl: string): string | null {
  if (!shouldProxyDifyImageUrl(url)) {
    return null
  }

  const normalizedBaseUrl = normalizeConfiguredDifyBaseUrl(configuredBaseUrl)
  if (!normalizedBaseUrl) {
    return null
  }

  if (url.startsWith("/")) {
    return `${normalizedBaseUrl}${url}`
  }

  try {
    const candidate = new URL(url)
    const allowedOrigin = new URL(normalizedBaseUrl).origin
    if (candidate.origin !== allowedOrigin) {
      return null
    }

    return candidate.toString()
  } catch {
    return null
  }
}
