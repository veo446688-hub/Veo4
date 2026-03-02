// Simple in-memory rate limiter
interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()

export function rateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; resetAt: number } {
  const now = Date.now()

  // Get or create entry
  let entry = rateLimitMap.get(identifier)

  if (!entry || now > entry.resetTime) {
    // Create new entry
    entry = {
      count: 1,
      resetTime: now + windowMs
    }
    rateLimitMap.set(identifier, entry)
    return { allowed: true, resetAt: entry.resetTime }
  }

  // Check if limit exceeded
  if (entry.count >= limit) {
    return { allowed: false, resetAt: entry.resetTime }
  }

  // Increment count
  entry.count++
  rateLimitMap.set(identifier, entry)

  return { allowed: true, resetAt: entry.resetTime }
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, 60000) // Cleanup every minute
