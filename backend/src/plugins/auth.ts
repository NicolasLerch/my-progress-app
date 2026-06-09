import type { FastifyReply, FastifyRequest } from "fastify"
import { demoUser } from "@my-progress/shared"
import { verifySupabaseToken } from "../lib/supabase.js"

declare module "fastify" {
  interface FastifyRequest {
    user: {
      id: string
      email: string
      name: string
      lastName?: string
      birthDate?: string
      weight?: number
      height?: number
    }
  }
}

function parseOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  const demoAuthEnabled = process.env.ALLOW_DEMO_AUTH === "true"

  if (!authHeader) {
    if (demoAuthEnabled) {
      request.user = demoUser
      return
    }

    await reply.code(401).send({ message: "Missing authorization header." })
    return
  }

  if (!authHeader.startsWith("Bearer ")) {
    await reply.code(401).send({ message: "Invalid authorization header." })
    return
  }

  const token = authHeader.slice("Bearer ".length).trim()

  if (!token) {
    await reply.code(401).send({ message: "Missing bearer token." })
    return
  }

  const payload = await verifySupabaseToken(token)

  if (!payload) {
    await reply.code(401).send({ message: "Invalid or expired token." })
    return
  }

  const metadata = payload.user_metadata

  request.user = {
    id: payload.sub,
    email: payload.email ?? `${payload.sub}@local.app`,
    name:
      typeof metadata?.name === "string" && metadata.name.length > 0
        ? metadata.name
        : payload.email?.split("@")[0] || "Usuario",
    lastName:
      typeof metadata?.lastName === "string"
        ? metadata.lastName
        : typeof metadata?.last_name === "string"
          ? metadata.last_name
          : undefined,
    birthDate:
      typeof metadata?.birthDate === "string"
        ? metadata.birthDate
        : typeof metadata?.birth_date === "string"
          ? metadata.birth_date
          : undefined,
    weight: parseOptionalNumber(metadata?.weight),
    height: parseOptionalNumber(metadata?.height),
  }
}
