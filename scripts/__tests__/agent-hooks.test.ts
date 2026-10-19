// Proof for the Claude Code hooks in .claude/hooks/: each case pipes a hook payload into the real
// script inside a throwaway git repo and asserts the exit code and channel (exit 2 + stderr is the
// only signal Claude sees). eslint, vitest and astro are stubbed on node_modules/.bin so the cases
// run in milliseconds; git, jq, npx, node and check-ui-literals.mjs are real.
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SOURCE = path.resolve(import.meta.dirname, "../..");
const HOOKS = ["_node.sh", "lint-edited-file.sh", "related-tests.sh", "end-of-turn.sh"];

// Stubs flag a marker in the files they get (or in src/, for the whole-suite and project runs)
// and log every invocation, so "no check ran" is observable.
const STUBS = {
  eslint: `#!/usr/bin/env bash
echo eslint >>"$STUB_LOG"
rc=0
for f in "$@"; do
  case "$f" in -*) continue ;; esac
  if grep -q LINT_ERROR "$f" 2>/dev/null; then echo "$f  1:7  error  'unused' is assigned a value but never used"; rc=1; fi
done
exit $rc`,
  vitest: `#!/usr/bin/env bash
echo "vitest $1" >>"$STUB_LOG"
if [ "$1" = related ]; then hits=$(grep -l TEST_FAIL "$2" 2>/dev/null); else hits=$(grep -rl TEST_FAIL src 2>/dev/null); fi
[ -z "$hits" ] || { echo "FAIL $hits > expected 1 to be 2"; exit 1; }`,
  astro: `#!/usr/bin/env bash
echo "astro $1" >>"$STUB_LOG"
hits=$(grep -rl TYPE_ERROR src 2>/dev/null)
[ -z "$hits" ] || { echo "$hits:1:1 - error ts(2322): Type 'string' is not assignable to type 'number'."; exit 1; }`,
};

let tmp: string;
let repo: string;
let other: string;
let log: string;

function git(cwd: string, ...args: string[]) {
  const res = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`git ${args.join(" ")}: ${res.stderr}`);
  return res.stdout.trim();
}

function env(extra: Record<string, string | undefined> = {}) {
  const base: Record<string, string | undefined> = {
    ...process.env,
    TMPDIR: tmp,
    STUB_LOG: log,
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@t",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@t",
    CLAUDE_PROJECT_DIR: undefined,
    ...extra,
  };
  return Object.fromEntries(Object.entries(base).filter((e): e is [string, string] => e[1] !== undefined));
}

/** A git repo with the hooks, stubbed tools, check-ui-literals.mjs and a clean src/, all committed. */
function makeRepo(dir: string) {
  mkdirSync(path.join(dir, ".claude/hooks"), { recursive: true });
  for (const h of HOOKS) cpSync(path.join(SOURCE, ".claude/hooks", h), path.join(dir, ".claude/hooks", h));
  cpSync(path.join(SOURCE, ".claude/settings.json"), path.join(dir, ".claude/settings.json"));
  mkdirSync(path.join(dir, "scripts"), { recursive: true });
  cpSync(path.join(SOURCE, "scripts/check-ui-literals.mjs"), path.join(dir, "scripts/check-ui-literals.mjs"));
  mkdirSync(path.join(dir, "node_modules/.bin"), { recursive: true });
  for (const [name, body] of Object.entries(STUBS)) {
    writeFileSync(path.join(dir, "node_modules/.bin", name), body);
    chmodSync(path.join(dir, "node_modules/.bin", name), 0o755);
  }
  mkdirSync(path.join(dir, "src/pages"), { recursive: true });
  mkdirSync(path.join(dir, "src/components"), { recursive: true });
  writeFileSync(path.join(dir, "package.json"), '{ "name": "hook-fixture", "private": true }\n');
  writeFileSync(path.join(dir, "src/clean.ts"), "export const ok = 1;\n");
  writeFileSync(path.join(dir, "src/pages/index.astro"), '<p class="text-muted-foreground">ok</p>\n');
  // git does not commit an empty directory, and check-ui-literals.mjs needs both in a worktree.
  writeFileSync(path.join(dir, "src/components/Ok.astro"), '<p class="text-muted-foreground">ok</p>\n');
  writeFileSync(path.join(dir, "README.md"), "fixture\n");
  spawnSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  git(dir, "add", "-A");
  spawnSync("git", ["commit", "-qm", "init"], { cwd: dir, env: env() });
}

function run(hook: string, payload: unknown, opts: { cwd?: string; env?: Record<string, string | undefined> } = {}) {
  const input = typeof payload === "string" ? payload : JSON.stringify(payload);
  const res = spawnSync(path.join(repo, ".claude/hooks", hook), [], {
    cwd: opts.cwd ?? repo,
    input,
    encoding: "utf8",
    env: env(opts.env),
  });
  return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}

const edit = (file: string, cwd = repo, extra: Record<string, unknown> = {}) => ({
  hook_event_name: "PostToolUse",
  tool_name: "Edit",
  cwd,
  tool_input: { file_path: file },
  ...extra,
});
const stop = (cwd = repo, extra: Record<string, unknown> = {}) => ({ hook_event_name: "Stop", cwd, ...extra });
const write = (dir: string, rel: string, body: string) => {
  writeFileSync(path.join(dir, rel), body);
  return path.join(dir, rel);
};
const logged = () => {
  try {
    return readFileSync(log, "utf8");
  } catch {
    return "";
  }
};

beforeEach(() => {
  tmp = mkdtempSync(path.join(tmpdir(), "agent-hooks-"));
  log = path.join(tmp, "stub.log");
  repo = path.join(tmp, "repo");
  other = path.join(tmp, "other");
  mkdirSync(repo);
  mkdirSync(other);
  makeRepo(repo);
  makeRepo(other);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("lint-edited-file.sh (PostToolUse Write|Edit)", () => {
  it("blocks a lint error with exit 2 and names the file on stderr", () => {
    const f = write(repo, "src/bad.ts", "const unused = 1; // LINT_ERROR\n");
    const r = run("lint-edited-file.sh", edit(f));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("ESLint reported errors in src/bad.ts");
    expect(r.stderr).toContain("never used");
  });

  it("blocks a palette literal in a view, only for the edited file", () => {
    write(repo, "src/components/Old.astro", '<p class="text-white">old</p>\n');
    const f = write(repo, "src/pages/new.astro", '<p class="bg-red-500">x</p>\n');
    const r = run("lint-edited-file.sh", edit(f));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("src/pages/new.astro:1: bg-red");
    expect(r.stderr).not.toContain("Old.astro");
  });

  it("passes a clean file silently", () => {
    const r = run("lint-edited-file.sh", edit(path.join(repo, "src/clean.ts")));
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
  });

  it("skips uncovered types, missing files and empty or broken payloads", () => {
    expect(run("lint-edited-file.sh", edit(path.join(repo, "README.md"))).code).toBe(0);
    expect(run("lint-edited-file.sh", edit(path.join(repo, "src/gone.ts"))).code).toBe(0);
    expect(run("lint-edited-file.sh", {}).code).toBe(0);
    expect(run("lint-edited-file.sh", "").code).toBe(0);
    expect(run("lint-edited-file.sh", "not json").code).toBe(0);
    expect(run("lint-edited-file.sh", { tool_name: "Write", cwd: repo, tool_input: {} }).code).toBe(0);
    expect(logged()).toBe("");
  });

  it("resolves a relative path against cwd", () => {
    write(repo, "src/bad.ts", "const unused = 1; // LINT_ERROR\n");
    const r = run("lint-edited-file.sh", edit("src/bad.ts"));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("src/bad.ts");
  });

  it("skips a broken file of another repository", () => {
    const f = write(other, "src/bad.ts", "const unused = 1; // LINT_ERROR\n");
    expect(run("lint-edited-file.sh", edit(f)).code).toBe(0);
  });

  it("checks the session checkout, not a CLAUDE_PROJECT_DIR pointing elsewhere", () => {
    write(other, "src/clean.ts", "const unused = 1; // LINT_ERROR\n");
    const r = run("lint-edited-file.sh", edit(path.join(repo, "src/clean.ts")), { env: { CLAUDE_PROJECT_DIR: other } });
    expect(r.code).toBe(0);
  });

  it("fails visibly when eslint is not installed", () => {
    rmSync(path.join(repo, "node_modules/.bin/eslint"));
    const r = run("lint-edited-file.sh", edit(path.join(repo, "src/clean.ts")));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("ESLint reported errors");
  });
});

describe("related-tests.sh (PostToolUse Write|Edit)", () => {
  it("blocks a failing related test with exit 2", () => {
    const f = write(repo, "src/math.test.ts", "expect(1).toBe(2); // TEST_FAIL\n");
    const r = run("related-tests.sh", edit(f));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Tests related to src/math.test.ts fail");
  });

  it("passes a clean file and skips uncovered or missing paths", () => {
    expect(run("related-tests.sh", edit(path.join(repo, "src/clean.ts"))).code).toBe(0);
    expect(run("related-tests.sh", edit(path.join(repo, "src/pages/index.astro"))).code).toBe(0);
    expect(run("related-tests.sh", edit(path.join(repo, "src/gone.ts"))).code).toBe(0);
    expect(run("related-tests.sh", "not json").code).toBe(0);
  });

  it("fails visibly when vitest is not installed", () => {
    rmSync(path.join(repo, "node_modules/.bin/vitest"));
    expect(run("related-tests.sh", edit(path.join(repo, "src/clean.ts"))).code).toBe(2);
  });
});

describe("end-of-turn.sh (Stop)", () => {
  it("passes without running any check when nothing changed", () => {
    const r = run("end-of-turn.sh", stop());
    expect(r.code).toBe(0);
    expect(logged()).toBe("");
  });

  it("blocks a lint error written to disk without a per-edit payload", () => {
    write(repo, "src/shell-written.ts", "const unused = 1; // LINT_ERROR\n");
    const r = run("end-of-turn.sh", stop());
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("ESLint errors in changed files");
    expect(r.stderr).toContain("src/shell-written.ts");
  });

  it("blocks a UI literal, a failing test and a type error in one message", () => {
    write(repo, "src/pages/index.astro", '<p class="text-white">x</p>\n');
    write(repo, "src/math.test.ts", "expect(1).toBe(2); // TEST_FAIL\n");
    write(repo, "src/clean.ts", "export const ok: number = 'x'; // TYPE_ERROR\n");
    const r = run("end-of-turn.sh", stop());
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("src/pages/index.astro:1: text-white");
    expect(r.stderr).toContain("Unit tests fail");
    expect(r.stderr).toContain("Typecheck fails (npx astro check)");
  });

  it("passes a clean change", () => {
    write(repo, "src/clean.ts", "export const ok = 2;\n");
    const r = run("end-of-turn.sh", stop());
    expect(r.code).toBe(0);
    expect(r.stderr).toBe("");
    expect(logged()).toContain("astro check");
  });

  it("lets the agent finish on the retry (stop_hook_active, Cursor loop_count)", () => {
    write(repo, "src/bad.ts", "const unused = 1; // LINT_ERROR\n");
    expect(run("end-of-turn.sh", stop(repo, { stop_hook_active: true })).code).toBe(0);
    expect(run("end-of-turn.sh", stop(repo, { loop_count: 1 })).code).toBe(0);
  });

  it("tolerates empty or broken payloads", () => {
    expect(run("end-of-turn.sh", {}).code).toBe(0);
    expect(run("end-of-turn.sh", "not json").code).toBe(0);
  });

  it("ignores a broken CLAUDE_PROJECT_DIR checkout", () => {
    write(other, "src/bad.ts", "const unused = 1; // LINT_ERROR\n");
    expect(run("end-of-turn.sh", stop(), { env: { CLAUDE_PROJECT_DIR: other } }).code).toBe(0);
  });

  it("sweeps a sibling worktree registered by the per-edit hook", () => {
    const wt = path.join(tmp, "wt");
    git(repo, "worktree", "add", "-q", wt);
    const session = { session_id: "sess-1" };
    expect(run("lint-edited-file.sh", edit(path.join(wt, "src/clean.ts"), repo, session)).code).toBe(0);
    write(wt, "src/wt-bad.ts", "const unused = 1; // LINT_ERROR\n");
    const r = run("end-of-turn.sh", stop(repo, session));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain(wt);
    expect(r.stderr).toContain("src/wt-bad.ts");
  });

  it("fails visibly when the typechecker is not installed", () => {
    rmSync(path.join(repo, "node_modules/.bin/astro"));
    write(repo, "src/clean.ts", "export const ok = 2;\n");
    const r = run("end-of-turn.sh", stop());
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Typecheck fails");
  });
});

describe(".claude/settings.json commands", () => {
  it("reach the scripts from a worktree with a stale CLAUDE_PROJECT_DIR", () => {
    const wt = path.join(tmp, "wt");
    git(repo, "worktree", "add", "-q", wt);
    const settings = JSON.parse(readFileSync(path.join(SOURCE, ".claude/settings.json"), "utf8")) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>;
    };
    const commands = Object.values(settings.hooks).flatMap((groups) =>
      groups.flatMap((g) => g.hooks.map((h) => h.command)),
    );
    expect(commands).toHaveLength(3);
    for (const command of commands) {
      const res = spawnSync("sh", ["-c", command], {
        cwd: wt,
        input: "{}",
        encoding: "utf8",
        env: env({ CLAUDE_PROJECT_DIR: path.join(tmp, "missing") }),
      });
      expect(res.status, `${command}: ${res.stderr}`).toBe(0);
    }
  });
});
