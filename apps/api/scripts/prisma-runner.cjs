const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "../..");

loadEnvFile(path.join(repoRoot, ".env"));
loadEnvFile(path.join(apiRoot, ".env"));

const prismaCliPath = require.resolve("prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCliPath, ...process.argv.slice(2)], {
  cwd: apiRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error("Failed to launch Prisma CLI.", result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const fileContents = fs.readFileSync(filePath, "utf8");

  for (const rawLine of fileContents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = /^([\w.-]+)\s*=\s*(.*)$/.exec(line);

    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;

    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = stripQuotes(rawValue);
  }
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
