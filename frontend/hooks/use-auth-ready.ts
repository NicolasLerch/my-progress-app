"use client"

import { useAuth } from "@/lib/auth"

export function useAuthReady() {
  const { isLoading, session, user } = useAuth()

  return {
    isLoading,
    session,
    user,
    isReady: !isLoading && Boolean(session),
  }
}
