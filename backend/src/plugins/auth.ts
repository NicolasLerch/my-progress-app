import type { FastifyReply, FastifyRequest } from "fastify"
import { demoUser } from "@my-progress/shared"

declare module "fastify" {
  interface FastifyRequest {
    user: {
      id: string
      email: string
      name: string
    }
  }
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  const demoUserId = request.headers["x-demo-user-id"]

  if (!authHeader && !demoUserId) {
    request.user = demoUser
    return
  }

  request.user = {
    id: typeof demoUserId === "string" ? demoUserId : demoUser.id,
    email: demoUser.email,
    name: demoUser.name,
  }

  if (authHeader && !authHeader.startsWith("Bearer ")) {
    await reply.code(401).send({ message: "Invalid authorization header." })
  }
}
