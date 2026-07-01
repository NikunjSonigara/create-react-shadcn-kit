import { createRequire } from "node:module";
import pc from "picocolors";
import { parseArgs } from "./utils.js";
import { promptConfig } from "./prompts.js";
import { scaffold } from "./scaffold.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json");

export async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        printHelp();
        return;
    }

    if (args.version) {
        console.log(pkg.version);
        return;
    }

    assertNodeVersion();

    console.log();
    console.log(pc.bold(pc.cyan("◆ create-react-shadcn-kit")) + pc.dim(` v${pkg.version} — React (Vite) + shadcn/ui starter`));

    const config = await promptConfig(args);
    await scaffold(config);

    console.log();
    console.log(pc.green("✔ Success!") + " Your project is ready.");
    console.log();
    console.log("Next steps:");
    console.log(pc.cyan(`  cd ${config.projectName}`));
    console.log(pc.cyan(`  ${devCommand(config.packageManager)}`));
    console.log();
    console.log(pc.dim("Docs: https://ui.shadcn.com"));
    console.log();
}

function devCommand(pm) {
    if (pm === "npm") return "npm run dev";
    if (pm === "yarn") return "yarn dev";
    return `${pm} dev`;
}

// Minimum Node supported by the generated project's toolchain. Vite 7 requires
// Node 20.19+/22.12+, Husky's lint-staged pulls in listr2 (Node >=22.13), and
// pnpm 11's binary needs node:sqlite (Node >=22.13), so the practical floor is
// Node 22.
export const MIN_NODE_MAJOR = 22;

export function isSupportedNode(version) {
    const major = Number(String(version).replace(/^v/, "").split(".")[0]);
    return Number.isFinite(major) && major >= MIN_NODE_MAJOR;
}

function assertNodeVersion() {
    if (!isSupportedNode(process.versions.node)) {
        throw new Error(
            `Node.js ${MIN_NODE_MAJOR}+ is required (Vite 7 and the pnpm/lint-staged toolchain need it). ` +
                `You are running ${process.versions.node}.`
        );
    }
}

function printHelp() {
    console.log(`
${pc.bold("create-react-shadcn-kit")} — Create a React (Vite) app with shadcn/ui pre-integrated.

${pc.bold("Usage:")}
  npx create-react-shadcn-kit [project-name] [options]

${pc.bold("Options:")}
  -y, --yes             Skip prompts and use defaults
  --ts, --typescript    Use TypeScript (default)
  --js, --javascript    Use JavaScript
  --npm                 Use npm (default)
  --pnpm                Use pnpm
  --yarn                Use yarn
  --bun                 Use bun
  --no-husky            Skip Husky + lint-staged setup
  --state=<lib>         State management: redux (default), zustand, none
  -v, --version         Show version
  -h, --help            Show this help

${pc.bold("Examples:")}
  npx create-react-shadcn-kit
  npx create-react-shadcn-kit my-app
  npx create-react-shadcn-kit my-app --yes --pnpm
`);
}
