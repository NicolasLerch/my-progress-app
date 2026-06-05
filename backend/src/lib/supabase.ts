import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let cachedClient: SupabaseClient | null = null

export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return null
  }

  if (!cachedClient) {
    cachedClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  return cachedClient
}
