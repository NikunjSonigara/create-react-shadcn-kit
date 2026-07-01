import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, isValidProjectName } from "../src/utils.js";
import { aliasPrefixFor } from "../src/scaffold.js";

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
