import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const secretPatterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  [
    "GitHub token",
    /(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/,
  ],
  ["AWS access key", /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  ["JWT", /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["session cookie", /(?:sessionid|csrftoken)=[A-Za-z0-9_%+/.-]{12,}/i],
];

function checkPackage() {
  const expected = new Set(["package.json", "README.md"]);
  const allowed = new Set([
    ...expected,
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
  ]);
  for (const dir of ["cli", "lib"]) {
    for (const entry of fs.readdirSync(path.join("src", dir))) {
      if (!entry.endsWith(".ts") || entry.endsWith(".d.ts")) continue;
      for (const extension of [".js", ".d.ts"]) {
        const file = `dist/${dir}/${entry.slice(0, -3)}${extension}`;
        expected.add(file);
        allowed.add(file);
      }
    }
  }

  // Ignore lifecycle scripts to avoid recursively invoking this prepack check.
  const output = execFileSync(
    "npm",
    ["pack", "--dry-run", "--ignore-scripts", "--json"],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  );
  const [manifest] = JSON.parse(output);
  const files = new Set(manifest.files.map((file) => file.path));
  const unexpected = [...files].filter((file) => !allowed.has(file));
  const missing = [...expected].filter((file) => !files.has(file));
  if (unexpected.length) {
    throw new Error(`Unexpected package files: ${unexpected.join(", ")}`);
  }
  if (missing.length) {
    throw new Error(`Missing package files: ${missing.join(", ")}`);
  }
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const [label, pattern] of secretPatterns) {
      if (pattern.test(content)) {
        // Report locations and categories without printing credential values.
        throw new Error(`Possible ${label} in package file: ${file}`);
      }
    }
  }
  if (process.env.npm_lifecycle_event !== "prepack") {
    console.log(`Package check passed (${files.size} files).`);
  }
}

try {
  checkPackage();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
