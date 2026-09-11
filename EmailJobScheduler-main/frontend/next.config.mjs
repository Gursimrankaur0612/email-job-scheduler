import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Next.js only auto-loads .env files from this app's own directory, but this
// monorepo keeps one shared .env at the repo root (also used by docker-compose
// and /backend). Load it into process.env here, before anything else runs.
function loadRootEnv() {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const contents = fs.readFileSync(envPath, "utf-8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (isQuoted) {
      value = value.slice(1, -1);
    }

    // A variable already set in the environment (e.g. by the shell, or by a
    // frontend-local .env.local) takes precedence over the shared root file.
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadRootEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
