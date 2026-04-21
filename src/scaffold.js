import path from "node:path";
import fs from "node:fs";
import pc from "picocolors";
import { run } from "./utils.js";

export async function scaffold(config) {
    const cwd = process.cwd();
    const projectPath = path.resolve(cwd, config.projectName);

    if (fs.existsSync(projectPath) && fs.readdirSync(projectPath).length > 0) {
        throw new Error(`Directory "${config.projectName}" already exists and is not empty.`);
    }

    console.log();
    console.log(pc.cyan("◆") + " Creating Vite + React app...");
    console.log();

    const template = config.typescript ? "react-ts" : "react";

    await run("npx", ["--yes", "create-vite@latest", config.projectName, "--template", template, "--no-interactive"]);

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
}

function aliasPrefix(importAlias) {
    const i = importAlias.indexOf("/*");
    return i === -1 ? importAlias : importAlias.slice(0, i);
}

function writeViteConfig(projectPath, config) {
    const ts = config.typescript;
    const alias = aliasPrefix(config.importAlias);
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

    const storeIndex = ts
        ? `import { configureStore } from "@reduxjs/toolkit";
import counterReducer from "./counterSlice";

export const store = configureStore({
  reducer: {
    counter: counterReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
`
        : `import { configureStore } from "@reduxjs/toolkit";
import counterReducer from "./counterSlice";

export const store = configureStore({
  reducer: {
    counter: counterReducer,
  },
});
`;
    fs.writeFileSync(path.join(storeDir, `index.${storeExt}`), storeIndex);

    const counterSlice = ts
        ? `import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface CounterState {
  value: number;
  status: "idle" | "loading";
}

const initialState: CounterState = { value: 0, status: "idle" };

export const incrementAsync = createAsyncThunk(
  "counter/incrementAsync",
  async (amount: number) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return amount;
  }
);

const counterSlice = createSlice({
  name: "counter",
  initialState,
  reducers: {
    increment: (state) => {
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
    incrementByAmount: (state, action: PayloadAction<number>) => {
      state.value += action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(incrementAsync.pending, (state) => {
        state.status = "loading";
      })
      .addCase(incrementAsync.fulfilled, (state, action) => {
        state.status = "idle";
        state.value += action.payload;
      });
  },
});

export const { increment, decrement, incrementByAmount } = counterSlice.actions;
export default counterSlice.reducer;
`
        : `import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const initialState = { value: 0, status: "idle" };

export const incrementAsync = createAsyncThunk(
  "counter/incrementAsync",
  async (amount) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return amount;
  }
);

const counterSlice = createSlice({
  name: "counter",
  initialState,
  reducers: {
    increment: (state) => {
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
    incrementByAmount: (state, action) => {
      state.value += action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(incrementAsync.pending, (state) => {
        state.status = "loading";
      })
      .addCase(incrementAsync.fulfilled, (state, action) => {
        state.status = "idle";
        state.value += action.payload;
      });
  },
});

export const { increment, decrement, incrementByAmount } = counterSlice.actions;
export default counterSlice.reducer;
`;
    fs.writeFileSync(path.join(storeDir, `counterSlice.${storeExt}`), counterSlice);

    if (ts) {
        const hooks = `import { useDispatch, useSelector } from "react-redux";
import type { TypedUseSelectorHook } from "react-redux";
import type { RootState, AppDispatch } from "./index";

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
`;
        fs.writeFileSync(path.join(storeDir, "hooks.ts"), hooks);
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

    const ts = config.typescript;
    const ext = ts ? "ts" : "js";
    const contents = ts
        ? `import { create } from "zustand";

interface CounterState {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
  decrement: () => set((s) => ({ count: s.count - 1 })),
  reset: () => set({ count: 0 }),
}));
`
        : `import { create } from "zustand";

export const useCounterStore = create((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
  decrement: () => set((s) => ({ count: s.count - 1 })),
  reset: () => set({ count: 0 }),
}));
`;
    fs.writeFileSync(path.join(storeDir, `useCounterStore.${ext}`), contents);
}

function patchMainWithProvider(srcDir, config) {
    const ts = config.typescript;
    const alias = aliasPrefix(config.importAlias);
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
    await run(
        installer.cmd,
        [...installer.args, "husky@^8", "lint-staged", "prettier"],
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
    const preCommit = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

${hookCmd}
`;
    const preCommitPath = path.join(huskyDir, "pre-commit");
    fs.writeFileSync(preCommitPath, preCommit);
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

    const prettierrc = {
        semi: true,
        singleQuote: false,
        tabWidth: 2,
        trailingComma: "es5",
        printWidth: 100,
        arrowParens: "always",
        endOfLine: "lf",
    };
    fs.writeFileSync(path.join(projectPath, ".prettierrc"), JSON.stringify(prettierrc, null, 2) + "\n");

    const prettierIgnore = [
        "node_modules",
        "dist",
        "build",
        "coverage",
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "bun.lock",
        "bun.lockb",
        "",
    ].join("\n");
    fs.writeFileSync(path.join(projectPath, ".prettierignore"), prettierIgnore);
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
            return { cmd: "yarn", args: dev ? ["add", "-D"] : ["add"] };
        case "bun":
            return { cmd: "bun", args: dev ? ["add", "-d"] : ["add"] };
        case "npm":
        default:
            return { cmd: "npm", args: dev ? ["install", "-D"] : ["install"] };
    }
}

