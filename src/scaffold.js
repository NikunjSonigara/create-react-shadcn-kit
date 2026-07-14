import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import pc from "picocolors";
import { run } from "./utils.js";

const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates");

// Read a template file shipped with the package. Templates are real, lintable
// source files; callers apply any substitutions (e.g. the pre-commit hook cmd).
export function readTemplate(...segments) {
    return fs.readFileSync(path.join(TEMPLATES_DIR, ...segments), "utf8");
}

export async function scaffold(config) {
    const cwd = process.cwd();
    const projectPath = path.resolve(cwd, config.projectName);

    // pnpm 10+/11 defaults strictDepBuilds=true, so unapproved dependency build
    // scripts (e.g. esbuild pulled in by Vite) abort the install in a
    // non-interactive run. Downgrade it to a warning for all child pnpm
    // processes; respect an explicit override if the user already set one.
    if (config.packageManager === "pnpm" && process.env.pnpm_config_strict_dep_builds === undefined) {
        process.env.pnpm_config_strict_dep_builds = "false";
    }

    if (fs.existsSync(projectPath) && fs.readdirSync(projectPath).length > 0) {
        throw new Error(`Directory "${config.projectName}" already exists and is not empty.`);
    }

    console.log();
    console.log(pc.cyan("◆") + " Creating Vite + React app...");
    console.log();

    const template = config.typescript ? "react-ts" : "react";

    await run("npx", ["--yes", "create-vite@latest", config.projectName, "--template", template, "--no-interactive"]);

    // Persist the pnpm build-script decision before installing, so both this
    // install and the end user's later `pnpm install` succeed (see the function).
    if (config.packageManager === "pnpm") {
        writePnpmBuildConfig(projectPath);
    }

    console.log();
    console.log(pc.cyan("◆") + " Installing dependencies...");
    console.log();

    const baseInstall = baseInstallFor(config.packageManager);
    await run(baseInstall.cmd, baseInstall.args, { cwd: projectPath });

    console.log();
    console.log(pc.cyan("◆") + " Installing Tailwind CSS...");
    console.log();

    const installer = installerFor(config.packageManager, false);
    await run(installer.cmd, [...installer.args, "tailwindcss", "@tailwindcss/vite"], { cwd: projectPath });

    if (config.typescript) {
        const devInstaller = installerFor(config.packageManager, true);
        await run(devInstaller.cmd, [...devInstaller.args, "@types/node"], { cwd: projectPath });
    }

    writeViteConfig(projectPath, config);
    writeTailwindCss(projectPath);
    writePathAliasConfig(projectPath, config);

    console.log();
    console.log(pc.cyan("◆") + " Initializing shadcn/ui...");
    console.log();

    await run("npx", ["--yes", "shadcn@latest", "init", "--yes", "--defaults"], { cwd: projectPath });

    if (config.components.length > 0) {
        console.log();
        console.log(pc.cyan("◆") + ` Adding components: ${pc.dim(config.components.join(", "))}`);
        console.log();

        await run("npx", ["--yes", "shadcn@latest", "add", ...config.components, "--yes"], { cwd: projectPath });
    }

    if (config.state === "redux") {
        await setupRedux(projectPath, config);
    } else if (config.state === "zustand") {
        await setupZustand(projectPath, config);
    }

    if (config.husky) {
        await setupHusky(projectPath, config);
    }

    await createInitialCommit(projectPath, config);
}

// Compose the initial-commit message, describing what the scaffold actually set
// up (language, styling, state management, hooks, components) so the project's
// first commit is self-documenting. The exact lines depend on the chosen config.
export function initialCommitMessage(config) {
    const lines = [
        `- Vite + React (${config.typescript ? "TypeScript" : "JavaScript"})`,
        "- Tailwind CSS + shadcn/ui",
    ];

    if (config.state === "redux") lines.push("- Redux Toolkit state management");
    else if (config.state === "zustand") lines.push("- Zustand state management");

    if (config.husky) lines.push("- Husky + lint-staged + Prettier pre-commit hooks");

    if (config.components?.length) lines.push(`- shadcn/ui components: ${config.components.join(", ")}`);

    return (
        "setup the project with the create-react-shadcn-kit\n\n" +
        lines.join("\n") +
        "\n\n" +
        "Co-authored-by: Nikunj Sonigara <nikunjsonigara987@gmail.com>"
    );
}

// Make an initial commit so the generated project starts from a clean, tracked
// baseline. Runs last so the whole scaffold (including any .husky/ hook files) is
// captured. Best-effort: git commit fails if the user has no git identity
// configured, so we warn and continue rather than abort an otherwise-successful
// scaffold. --no-verify skips the freshly-installed pre-commit hook so the
// baseline commit can't be blocked (or slowed) by lint-staged/tsc.
async function createInitialCommit(projectPath, config) {
    console.log();
    console.log(pc.cyan("◆") + " Creating initial commit...");
    console.log();

    const gitDir = path.join(projectPath, ".git");
    if (!fs.existsSync(gitDir)) {
        await run("git", ["init"], { cwd: projectPath });
    }

    try {
        await run("git", ["add", "-A"], { cwd: projectPath });
        await run("git", ["commit", "--no-verify", "-m", initialCommitMessage(config)], { cwd: projectPath });
    } catch {
        console.log(
            pc.yellow("⚠") +
                " Skipped the initial commit — configure git user.name and user.email, then commit manually."
        );
    }
}

// pnpm 11 defaults strictDepBuilds=true, so a later `pnpm install` in the
// generated project hard-fails (ERR_PNPM_IGNORED_BUILDS) on unapproved
// dependency build scripts that Vite pulls in (esbuild). Unlike create-next-app,
// create-vite leaves no pnpm-workspace.yaml behind, so we write one with an
// explicit decision:
//   - allowBuilds: esbuild: false -> a deliberate "don't run this build script"
//     (esbuild's platform binary ships via its optional dependency, so nothing
//     untrusted needs to execute at install time).
//   - strictDepBuilds: false       -> catch-all so a future native dependency
//     can't reintroduce the hard install failure.
// pnpm 11 reads these from pnpm-workspace.yaml, not .npmrc.
export function writePnpmBuildConfig(projectPath) {
    const wsPath = path.join(projectPath, "pnpm-workspace.yaml");
    const contents = `# Let \`pnpm install\` succeed without failing on dependency build scripts.
# See https://pnpm.io/settings#strictdepbuilds
strictDepBuilds: false
allowBuilds:
  esbuild: false
`;
    fs.writeFileSync(wsPath, contents);
}

// Turn a tsconfig-style import alias pattern (e.g. "@/*", "~/*") into the
// prefix used in import statements ("@", "~"). Falls back to "@" if empty.
export function aliasPrefixFor(importAlias) {
    const prefix = String(importAlias || "@/*")
        .replace(/\*$/, "")
        .replace(/\/$/, "");
    return prefix || "@";
}

function writeViteConfig(projectPath, config) {
    const ts = config.typescript;
    const alias = aliasPrefixFor(config.importAlias);
    const configFile = path.join(projectPath, ts ? "vite.config.ts" : "vite.config.js");

    const contents = ts
        ? `import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "${alias}": path.resolve(__dirname, "./src"),
    },
  },
})
`
        : `import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "${alias}": path.resolve(__dirname, "./src"),
    },
  },
})
`;
    fs.writeFileSync(configFile, contents);
}

function writeTailwindCss(projectPath) {
    const cssPath = path.join(projectPath, "src", "index.css");
    fs.writeFileSync(cssPath, `@import "tailwindcss";\n`);
}

function writePathAliasConfig(projectPath, config) {
    const alias = config.importAlias;

    if (config.typescript) {
        patchTsconfig(path.join(projectPath, "tsconfig.json"), alias, true);
        patchTsconfig(path.join(projectPath, "tsconfig.app.json"), alias, false);
    } else {
        const jsconfigPath = path.join(projectPath, "jsconfig.json");
        const jsconfig = {
            compilerOptions: {
                paths: {
                    [alias]: ["./src/*"],
                },
            },
        };
        fs.writeFileSync(jsconfigPath, JSON.stringify(jsconfig, null, 2) + "\n");
    }
}

function patchTsconfig(filePath, alias, isRoot) {
    if (!fs.existsSync(filePath)) {
        console.log(pc.yellow("⚠") + ` ${path.basename(filePath)} not found — skipping.`);
        return;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = parseJsonc(raw);

    if (!parsed.compilerOptions) parsed.compilerOptions = {};
    parsed.compilerOptions.paths = {
        ...(parsed.compilerOptions.paths || {}),
        [alias]: ["./src/*"],
    };

    fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2) + "\n");
}

function parseJsonc(s) {
    const stripped = s
        .replace(/\\"|"(?:\\"|[^"])*"|(\/\/[^\n\r]*|\/\*[\s\S]*?\*\/)/g, (m, g1) => (g1 ? "" : m));
    return JSON.parse(stripped);
}

async function setupRedux(projectPath, config) {
    console.log();
    console.log(pc.cyan("◆") + " Setting up Redux Toolkit...");
    console.log();

    const installer = installerFor(config.packageManager, false);
    await run(installer.cmd, [...installer.args, "@reduxjs/toolkit", "react-redux"], { cwd: projectPath });

    const srcDir = path.join(projectPath, "src");
    const storeDir = path.join(srcDir, "store");
    fs.mkdirSync(storeDir, { recursive: true });

    const ts = config.typescript;
    const storeExt = ts ? "ts" : "js";

    fs.writeFileSync(path.join(storeDir, `index.${storeExt}`), readTemplate("redux", `index.${storeExt}`));
    fs.writeFileSync(path.join(storeDir, `counterSlice.${storeExt}`), readTemplate("redux", `counterSlice.${storeExt}`));

    if (ts) {
        fs.writeFileSync(path.join(storeDir, "hooks.ts"), readTemplate("redux", "hooks.ts"));
    }

    patchMainWithProvider(srcDir, config);
}

async function setupZustand(projectPath, config) {
    console.log();
    console.log(pc.cyan("◆") + " Setting up Zustand...");
    console.log();

    const installer = installerFor(config.packageManager, false);
    await run(installer.cmd, [...installer.args, "zustand"], { cwd: projectPath });

    const storeDir = path.join(projectPath, "src", "store");
    fs.mkdirSync(storeDir, { recursive: true });

    const ext = config.typescript ? "ts" : "js";
    fs.writeFileSync(
        path.join(storeDir, `useCounterStore.${ext}`),
        readTemplate("zustand", `useCounterStore.${ext}`)
    );
}

function patchMainWithProvider(srcDir, config) {
    const ts = config.typescript;
    const alias = aliasPrefixFor(config.importAlias);
    const mainPath = path.join(srcDir, ts ? "main.tsx" : "main.jsx");

    if (!fs.existsSync(mainPath)) {
        console.log(pc.yellow("⚠") + ` Could not find ${path.basename(mainPath)} — wrap <App /> with <Provider store={store}> manually.`);
        return;
    }

    let main = fs.readFileSync(mainPath, "utf8");
    const original = main;

    if (!/from ["']react-redux["']/.test(main)) {
        main = `import { Provider } from "react-redux";\nimport { store } from "${alias}/store";\n${main}`;
    }

    if (!main.includes("<Provider") && /<App\s*\/>/.test(main)) {
        main = main.replace(/<App\s*\/>/, "<Provider store={store}>\n      <App />\n    </Provider>");
    }

    if (main === original) {
        console.log(pc.yellow("⚠") + ` Could not auto-wrap ${path.basename(mainPath)} — please wrap <App /> with <Provider store={store}> manually.`);
        return;
    }

    fs.writeFileSync(mainPath, main);
}

async function setupHusky(projectPath, config) {
    console.log();
    console.log(pc.cyan("◆") + " Setting up Husky + lint-staged + Prettier...");
    console.log();

    const installer = installerFor(config.packageManager, true);
    // Pin lint-staged to ^16: its latest major (17) requires Node >=22.22.1,
    // which is above this kit's declared Node floor (>=22.0.0). npm/pnpm/bun
    // only warn on that engine mismatch and install it anyway, leaving the
    // pre-commit hook on an unsupported Node; yarn classic aborts outright.
    // ^16 needs only Node >=20.17, so it works across every supported version.
    await run(
        installer.cmd,
        [...installer.args, "husky@^8", "lint-staged@^16", "prettier"],
        { cwd: projectPath }
    );

    const pkgPath = path.join(projectPath, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    pkg.scripts = {
        ...pkg.scripts,
        prepare: "husky install",
        format: "prettier --check .",
        "format:fix": "prettier --write .",
        "lint:fix": "eslint --fix",
        ...(config.typescript ? { typecheck: "tsc --noEmit" } : {}),
    };
    delete pkg["lint-staged"];
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

    const gitDir = path.join(projectPath, ".git");
    if (!fs.existsSync(gitDir)) {
        await run("git", ["init"], { cwd: projectPath });
    }

    await run("npx", ["husky", "install"], { cwd: projectPath });

    await run("git", ["config", "core.hooksPath", ".husky"], { cwd: projectPath });

    const huskyDir = path.join(projectPath, ".husky");
    if (!fs.existsSync(huskyDir)) fs.mkdirSync(huskyDir, { recursive: true });

    const hookCmd = config.typescript
        ? "npx tsc --noEmit && npx lint-staged"
        : "npx lint-staged";
    const preCommitPath = path.join(huskyDir, "pre-commit");
    fs.writeFileSync(preCommitPath, readTemplate("husky", "pre-commit").replace("__HOOK_CMD__", hookCmd));
    fs.chmodSync(preCommitPath, 0o755);

    const jsGlob = config.typescript ? "*.{js,jsx,ts,tsx}" : "*.{js,jsx}";
    const lintStagedConfig = {
        [jsGlob]: ["eslint --fix", "prettier --write"],
        "*.{json,css,scss,md,mdx,yml,yaml,html}": ["prettier --write"],
    };
    fs.writeFileSync(
        path.join(projectPath, ".lintstagedrc.json"),
        JSON.stringify(lintStagedConfig, null, 2) + "\n"
    );

    fs.writeFileSync(path.join(projectPath, ".prettierrc"), readTemplate("husky", "prettierrc.json"));
    fs.writeFileSync(path.join(projectPath, ".prettierignore"), readTemplate("husky", "prettierignore"));
}

function baseInstallFor(pm) {
    switch (pm) {
        case "pnpm":
            return { cmd: "pnpm", args: ["install"] };
        case "yarn":
            return { cmd: "yarn", args: ["install"] };
        case "bun":
            return { cmd: "bun", args: ["install"] };
        case "npm":
        default:
            return { cmd: "npm", args: ["install"] };
    }
}

function installerFor(pm, dev = true) {
    switch (pm) {
        case "pnpm":
            return { cmd: "pnpm", args: dev ? ["add", "-D"] : ["add"] };
        case "yarn":
            // yarn classic (v1) treats an `engines` mismatch on any dependency
            // (direct or transitive) as a hard error and aborts the install,
            // whereas npm/pnpm/bun only warn. --ignore-engines aligns yarn with
            // the others so the scaffold doesn't spuriously fail on a Node range
            // the kit already declares as supported.
            return { cmd: "yarn", args: dev ? ["add", "-D", "--ignore-engines"] : ["add", "--ignore-engines"] };
        case "bun":
            return { cmd: "bun", args: dev ? ["add", "-d"] : ["add"] };
        case "npm":
        default:
            return { cmd: "npm", args: dev ? ["install", "-D"] : ["install"] };
    }
}

