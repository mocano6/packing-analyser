/**
 * Generuje listę commitów od ostatniego merge z main do pliku public/changelog.json.
 * Uruchamiane przed buildem (prebuild) lub ręcznie.
 * Format: { commits: [ { hash, subject, date } ], generatedAt }
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const OUT_FILE = path.join(PUBLIC_DIR, "changelog.json");

function getCommitsSinceMain() {
  const refs = ["origin/main", "main"];
  for (const ref of refs) {
    try {
      const out = execSync(
        `git log ${ref}..HEAD --pretty=format:"%h|%s|%ci" --no-merges`,
        { encoding: "utf-8", maxBuffer: 1024 * 1024 }
      );
      const lines = out.trim().split("\n").filter(Boolean);
      return lines.map((line) => {
        const parts = line.split("|");
        const hash = parts[0] || "";
        const date = parts[parts.length - 1] || "";
        const subject = parts.slice(1, -1).join("|").trim();
        return { hash, subject, date };
      });
    } catch (_) {
      continue;
    }
  }
  return [];
}

function main() {
  const commits = getCommitsSinceMain();
  const payload = {
    commits,
    generatedAt: new Date().toISOString(),
  };
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`Changelog: ${commits.length} commits since main → ${OUT_FILE}`);
}

main();
