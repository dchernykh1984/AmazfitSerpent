// Formats a file that was just edited, so `npm run format:check` cannot fail in
// CI over something an agent wrote a moment ago. Prettier owns formatting in this
// repository and the pre-commit hook runs the same check.
//
// Wired up as a PostToolUse hook in .claude/settings.json. It lives here rather
// than under .claude/ because ESLint's `**` does not descend into dot-directories,
// so a file there cannot be given the Node globals it needs. The hook payload
// arrives as JSON on stdin; the file is in `tool_input.file_path`.
//
// It never fails the tool call it follows: a formatting convenience must not be
// able to block editing. Anything unexpected exits 0 in silence.
import { spawn } from "node:child_process";

const FORMATTED = /\.(m?js|cjs|json|md|ya?ml)$/i;
// Prettier is told to ignore these, so running it on one would be a no-op at best.
const SKIP = /(^|[\\/])(node_modules|dist|build|coverage)[\\/]|package-lock\.json$|CHANGELOG\.md$/i;

function readStdin() {
  return new Promise((resolve) => {
    let text = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      text += chunk;
    });
    process.stdin.on("end", () => resolve(text));
    process.stdin.on("error", () => resolve(""));
  });
}

const raw = await readStdin();

let filePath = "";
try {
  filePath = JSON.parse(raw)?.tool_input?.file_path ?? "";
} catch {
  // Not the payload we expected - nothing to format.
}

if (!filePath || !FORMATTED.test(filePath) || SKIP.test(filePath)) {
  process.exit(0);
}

// `shell: true` so the platform's npx resolution is used as-is.
const prettier = spawn("npx", ["prettier", "--write", filePath], {
  stdio: "ignore",
  shell: true,
});
prettier.on("error", () => process.exit(0));
prettier.on("close", () => process.exit(0));
