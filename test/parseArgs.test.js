import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs, isValidProjectName } from "../src/utils.js";
import { aliasPrefixFor, writePnpmBuildConfig, readTemplate, initialCommitMessage } from "../src/scaffold.js";
import { isSupportedNode, MIN_NODE_MAJOR } from "../src/index.js";

test("positional project name is captured", () => {
    assert.equal(parseArgs(["my-app"]).projectName, "my-app");
});

test("boolean flag before the name does NOT swallow it (regression)", () => {
    // Each boolean flag, placed before the positional, must leave the name intact.
    for (const flag of ["--pnpm", "--yarn", "--bun", "--npm", "--ts", "--js", "--yes", "--no-husky"]) {
        const args = parseArgs([flag, "my-app"]);
        assert.equal(args.projectName, "my-app", `${flag} should not consume the project name`);
    }
});

test("package manager flags resolve correctly", () => {
    assert.equal(parseArgs(["--pnpm"]).packageManager, "pnpm");
    assert.equal(parseArgs(["--yarn"]).packageManager, "yarn");
    assert.equal(parseArgs(["--bun"]).packageManager, "bun");
    assert.equal(parseArgs(["--npm"]).packageManager, "npm");
    assert.equal(parseArgs([]).packageManager, undefined);
});

test("typescript / javascript flags", () => {
    assert.equal(parseArgs(["--ts"]).typescript, true);
    assert.equal(parseArgs(["--typescript"]).typescript, true);
    assert.equal(parseArgs(["--js"]).typescript, false);
    assert.equal(parseArgs(["--javascript"]).typescript, false);
    assert.equal(parseArgs([]).typescript, undefined);
});

test("--no-husky disables husky", () => {
    assert.equal(parseArgs(["--no-husky"]).husky, false);
    assert.equal(parseArgs([]).husky, undefined);
});

test("initialCommitMessage summarizes the chosen config and carries the co-author trailer", () => {
    const msg = initialCommitMessage({
        typescript: true,
        state: "redux",
        husky: true,
        components: ["button", "card"],
    });
    assert.match(msg, /^setup the project with the create-react-shadcn-kit\n/);
    assert.match(msg, /- Vite \+ React \(TypeScript\)/);
    assert.match(msg, /- Tailwind CSS \+ shadcn\/ui/);
    assert.match(msg, /- Redux Toolkit state management/);
    assert.match(msg, /- Husky \+ lint-staged \+ Prettier pre-commit hooks/);
    assert.match(msg, /- shadcn\/ui components: button, card/);
    // Trailer must be the last block, preceded by a blank line, so git parses it.
    assert.match(msg, /\n\nCo-authored-by: Nikunj Sonigara <nikunjsonigara987@gmail.com>$/);
});

test("initialCommitMessage omits optional lines for a minimal config", () => {
    const msg = initialCommitMessage({ typescript: false, state: "none", husky: false, components: [] });
    assert.match(msg, /- Vite \+ React \(JavaScript\)/);
    assert.doesNotMatch(msg, /state management/);
    assert.doesNotMatch(msg, /pre-commit hooks/);
    assert.doesNotMatch(msg, /components:/);
    assert.match(msg, /\n\nCo-authored-by: Nikunj Sonigara <nikunjsonigara987@gmail.com>$/);
});

test("--state accepts both = and space forms, rejects unknown values", () => {
    assert.equal(parseArgs(["--state=zustand"]).state, "zustand");
    assert.equal(parseArgs(["--state", "zustand"]).state, "zustand");
    assert.equal(parseArgs(["--state=redux"]).state, "redux");
    assert.equal(parseArgs(["--state=bogus"]).state, undefined);
});

test("--state value form still leaves a trailing positional name", () => {
    const args = parseArgs(["--state", "zustand", "my-app"]);
    assert.equal(args.state, "zustand");
    assert.equal(args.projectName, "my-app");
});

test("short flags -y -h -v", () => {
    assert.equal(parseArgs(["-y"]).yes, true);
    assert.equal(parseArgs(["-h"]).help, true);
    assert.equal(parseArgs(["-v"]).version, true);
});

test("combined realistic invocation", () => {
    const args = parseArgs(["my-app", "--yes", "--pnpm", "--state=zustand", "--no-husky"]);
    assert.deepEqual(
        {
            projectName: args.projectName,
            yes: args.yes,
            packageManager: args.packageManager,
            state: args.state,
            husky: args.husky,
        },
        { projectName: "my-app", yes: true, packageManager: "pnpm", state: "zustand", husky: false }
    );
});

test("isValidProjectName accepts valid names", () => {
    for (const name of ["my-app", "app", "my_app", "@scope/app", "a.b.c", "my-app123"]) {
        assert.equal(isValidProjectName(name), true, `${name} should be valid`);
    }
});

test("isValidProjectName rejects traversal and bad input", () => {
    for (const name of ["..", ".", "../foo", "foo/bar", "/abs", "", null, undefined, "a".repeat(215)]) {
        assert.equal(isValidProjectName(name), false, `${JSON.stringify(name)} should be invalid`);
    }
});

test("aliasPrefixFor derives the import prefix", () => {
    assert.equal(aliasPrefixFor("@/*"), "@");
    assert.equal(aliasPrefixFor("~/*"), "~");
    assert.equal(aliasPrefixFor("@/"), "@");
    assert.equal(aliasPrefixFor(""), "@");
    assert.equal(aliasPrefixFor(undefined), "@");
});

test("isSupportedNode enforces the Node 22+ floor", () => {
    assert.equal(MIN_NODE_MAJOR, 22);
    assert.equal(isSupportedNode("22.0.0"), true);
    assert.equal(isSupportedNode("24.1.0"), true);
    assert.equal(isSupportedNode("v22.13.0"), true);
    assert.equal(isSupportedNode("20.20.2"), false);
    assert.equal(isSupportedNode("18.19.0"), false);
    assert.equal(isSupportedNode("garbage"), false);
});

test("readTemplate returns the TS/JS Redux templates", () => {
    const indexTs = readTemplate("redux", "index.ts");
    assert.match(indexTs, /configureStore/);
    assert.match(indexTs, /export type RootState/);

    const indexJs = readTemplate("redux", "index.js");
    assert.match(indexJs, /configureStore/);
    assert.doesNotMatch(indexJs, /RootState/); // JS variant has no type exports
});

test("redux counterSlice templates ship the async thunk", () => {
    assert.match(readTemplate("redux", "counterSlice.ts"), /createAsyncThunk/);
    const js = readTemplate("redux", "counterSlice.js");
    assert.match(js, /createAsyncThunk/);
    assert.doesNotMatch(js, /PayloadAction/); // JS variant has no type imports
});

test("readTemplate returns the TS/JS Zustand store", () => {
    assert.match(readTemplate("zustand", "useCounterStore.ts"), /create<CounterState>/);
    const js = readTemplate("zustand", "useCounterStore.js");
    assert.match(js, /export const useCounterStore = create\(/);
    assert.doesNotMatch(js, /CounterState/); // JS variant has no interface
});

test("husky config templates match the previous inline output byte-for-byte", () => {
    const prettierrc =
        JSON.stringify(
            { semi: true, singleQuote: false, tabWidth: 2, trailingComma: "es5", printWidth: 100, arrowParens: "always", endOfLine: "lf" },
            null,
            2
        ) + "\n";
    assert.equal(readTemplate("husky", "prettierrc.json"), prettierrc);

    const prettierignore =
        ["node_modules", "dist", "build", "coverage", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", ""].join("\n");
    assert.equal(readTemplate("husky", "prettierignore"), prettierignore);

    // pre-commit carries a single __HOOK_CMD__ placeholder.
    const preCommit = readTemplate("husky", "pre-commit");
    assert.equal(preCommit.match(/__HOOK_CMD__/g)?.length, 1);
    assert.equal(
        preCommit.replace("__HOOK_CMD__", "npx lint-staged"),
        `#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\nnpx lint-staged\n`
    );
});

test("writePnpmBuildConfig writes a valid single-decision workspace file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "crs-pnpm-"));
    try {
        writePnpmBuildConfig(dir);
        const out = fs.readFileSync(path.join(dir, "pnpm-workspace.yaml"), "utf8");

        // Exactly one allowBuilds key (a duplicate would be invalid YAML).
        assert.equal(out.match(/^allowBuilds:/gm)?.length, 1);
        assert.match(out, /^strictDepBuilds: false$/m);
        assert.match(out, /esbuild: false/);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
