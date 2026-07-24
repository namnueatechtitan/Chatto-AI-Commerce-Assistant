/**
 * หน้าที่ไฟล์: ไฟล์นี้เป็นตัวช่วยรันคำสั่ง Prisma พร้อมโหลดค่า environment ให้พร้อมก่อนสั่งงานจริง
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "../..");

loadEnvFile(path.join(repoRoot, ".env"));
loadEnvFile(path.join(apiRoot, ".env"));
process.env.CHECKPOINT_DISABLE ??= "1";

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

/**
 * หน้าที่: อ่านไฟล์ .env แบบง่าย ๆ แล้วแปลงค่าที่อ่านได้ให้อยู่ในรูป object
 */
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

/**
 * หน้าที่: ตัด quote ที่ครอบค่าจากไฟล์ environment ออกก่อนนำไปใช้งาน
 */
function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
