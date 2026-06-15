const BASE_URL = import.meta.env.VITE_API_URL

interface FetchOptions extends RequestInit {
  timeout?: number
  retries?: number
}

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function apiFetch<T>(
  endpoint: string, 
  options: FetchOptions = {}
): Promise<T> {
  const { timeout = 5000, retries = 2,...fetchOptions } = options
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
       ...fetchOptions,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json',...fetchOptions.headers }
      })
      
      clearTimeout(timeoutId)
      
      if (!res.ok) {
        throw new ApiError(`HTTP ${res.status}`, res.status)
      }
      
      return await res.json()
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new ApiError('Request timeout', 408)
      }
      if (i === retries) throw err
      await new Promise(r => setTimeout(r, 1000 * (i + 1))) // backoff
    }
  }
  throw new Error('Unreachable')
}

export const api = {
  get: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: any) => apiFetch<T>(endpoint, { 
    method: 'POST', 
    body: JSON.stringify(body) 
  })
}

export type ApiStatus = 'LIVE' | 'STANDBY' | 'ERROR'
