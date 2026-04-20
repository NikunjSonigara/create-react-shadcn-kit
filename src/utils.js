import { spawn } from "node:child_process";

export function parseArgs(argv) {
    const positional = [];
    const flags = {};

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith("--")) {
            const eq = arg.indexOf("=");
            if (eq !== -1) {
                flags[arg.slice(2, eq)] = arg.slice(eq + 1);
            } else {
                const key = arg.slice(2);
                const next = argv[i + 1];
                if (next && !next.startsWith("-")) {
                    flags[key] = next;
                    i++;
                } else {
                    flags[key] = true;
                }
            }
        } else if (arg.startsWith("-") && arg.length > 1) {
            flags[arg.slice(1)] = true;
        } else {
            positional.push(arg);
        }
    }

    const pm = flags.pnpm ? "pnpm" : flags.yarn ? "yarn" : flags.bun ? "bun" : flags.npm ? "npm" : undefined;

    let ts;
    if (flags.ts || flags.typescript) ts = true;
    else if (flags.js || flags.javascript) ts = false;

    const state = ["redux", "zustand", "none"].includes(flags.state) ? flags.state : undefined;

    return {
        projectName: positional[0],
        yes: Boolean(flags.yes || flags.y),
        help: Boolean(flags.help || flags.h),
        version: Boolean(flags.version || flags.v),
        typescript: ts,
        packageManager: pm,
        husky: flags["no-husky"] ? false : undefined,
        state,
    };
}

export function run(cmd, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {
            stdio: "inherit",
            shell: process.platform === "win32",
            ...options,
        });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Command failed: ${cmd} ${args.join(" ")} (exit ${code})`));
        });
    });
}

export function isValidProjectName(name) {
    if (!name || typeof name !== "string") return false;
    if (name.length > 214) return false;
    if (name === "." || name === "..") return false;
    return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(name);
}
