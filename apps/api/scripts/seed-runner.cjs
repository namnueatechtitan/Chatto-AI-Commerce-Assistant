/**
 * หน้าที่ไฟล์: ไฟล์นี้เป็นตัวช่วยรัน Prisma seed พร้อมโหลดค่า environment ที่โปรเจกต์ต้องใช้
 */

const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "../..");
const seedPath = path.join(apiRoot, "prisma", "seed.ts");

loadEnvFile(path.join(repoRoot, ".env"));
loadEnvFile(path.join(apiRoot, ".env"));
runSeedFile(seedPath);

/**
 * หน้าที่: รันไฟล์ seed ของ Prisma โดยส่งต่อ environment ที่โหลดไว้แล้วไปยัง process ลูก
 */
function runSeedFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const SeedModule = module.constructor;
  const seedModule = new SeedModule(filePath, module.parent ?? module);

  seedModule.filename = filePath;
  seedModule.paths = Module._nodeModulePaths(path.dirname(filePath));
  seedModule._compile(source, filePath);
}

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
