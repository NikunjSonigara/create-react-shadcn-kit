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

function assertNodeVersion() {
    const major = Number(process.versions.node.split(".")[0]);
    if (major < 18) {
        throw new Error(`Node.js 18.17+ is required. You are running ${process.versions.node}.`);
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
