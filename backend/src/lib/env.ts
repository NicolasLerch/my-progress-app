import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"

const currentDir = dirname(fileURLToPath(import.meta.url))
const backendRoot = resolve(currentDir, "../..")
const repoRoot = resolve(backendRoot, "..")

const envFiles = [
  resolve(backendRoot, ".env.local"),
  resolve(backendRoot, ".env"),
  resolve(repoRoot, ".env.local"),
  resolve(repoRoot, ".env"),
]

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    config({ path: envFile, override: false })
  }
}
