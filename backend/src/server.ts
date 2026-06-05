import "./lib/env.js"
import Fastify from "fastify"
import cors from "@fastify/cors"
import { registerRoutes } from "./routes.js"

async function buildServer() {
  const app = Fastify({ logger: true })

  await app.register(cors, {
    origin: true,
    credentials: true,
  })

  await registerRoutes(app)

  return app
}

async function start() {
  const app = await buildServer()
  const port = Number(process.env.PORT ?? 4000)
  const host = process.env.HOST ?? "0.0.0.0"

  try {
    await app.listen({ port, host })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

start()
