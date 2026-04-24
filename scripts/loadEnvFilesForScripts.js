/**
 * Minimalne wczytanie .env / .env.local do process.env (bez zależności dotenv).
 * Kolejność jak w Next: .env, potem .env.local nadpisuje.
 */
const fs = require("fs");
const path = require("path");

function applyLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) return;
  const key = trimmed.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return;
  let val = trimmed.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

function loadFile(name) {
  const p = path.join(process.cwd(), name);
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    applyLine(line);
  }
}

function loadStandardEnvFiles() {
  loadFile(".env");
  loadFile(".env.local");
  loadFile(".env.development");
}

module.exports = { loadStandardEnvFiles };
