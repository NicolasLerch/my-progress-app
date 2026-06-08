import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose"

export interface SupabaseJwtPayload extends JWTPayload {
  sub: string
  email?: string
  role?: string
  aud?: string | string[]
  user_metadata?: Record<string, unknown>
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL environment variable.")
}

const issuer = new URL("/auth/v1", supabaseUrl).toString().replace(/\/$/, "")
const jwks = createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", supabaseUrl))

export async function verifySupabaseToken(accessToken: string): Promise<SupabaseJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(accessToken, jwks, {
      issuer,
      audience: "authenticated",
    })

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return null
    }

    return payload as SupabaseJwtPayload
  } catch {
    return null
  }
}
