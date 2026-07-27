type ApiBody = BodyInit | object | null | undefined

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: ApiBody
  parseJson?: boolean
}

export async function apiRequest<T = unknown>(
  url: string,
  options: ApiOptions = {}
): Promise<T> {
  const { body, headers, parseJson = true, ...rest } = options
  const requestHeaders = new Headers(headers)
  let requestBody: BodyInit | undefined

  if (body instanceof URLSearchParams || typeof body === 'string' || body instanceof FormData) {
    requestBody = body
  } else if (body !== undefined && body !== null) {
    requestHeaders.set('Content-Type', 'application/json')
    requestBody = JSON.stringify(body)
  }

  const res = await fetch(url, {
    credentials: 'include',
    ...rest,
    headers: requestHeaders,
    body: requestBody,
  })

  const data = parseJson ? await res.json().catch(() => ({})) : undefined
  if (!res.ok) {
    const message = typeof data === 'object' && data && 'error' in data
      ? String((data as { error?: unknown }).error)
      : 'Error de conexion con el backend'
    throw new Error(message)
  }

  return data as T
}

export function formBody(values: Record<string, string | number | boolean>) {
  const body = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => body.set(key, String(value)))
  return body
}
