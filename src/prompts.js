import prompts from "prompts";
import pc from "picocolors";
import { isValidProjectName } from "./utils.js";

const COMPONENT_CHOICES = [
    { title: "button", value: "button", selected: true },
    { title: "card", value: "card", selected: true },
    { title: "input", value: "input", selected: true },
    { title: "label", value: "label", selected: true },
    { title: "form", value: "form", selected: false },
    { title: "dialog", value: "dialog", selected: false },
    { title: "dropdown-menu", value: "dropdown-menu", selected: false },
    { title: "select", value: "select", selected: false },
    { title: "sonner (toast)", value: "sonner", selected: false },
    { title: "tabs", value: "tabs", selected: false },
    { title: "textarea", value: "textarea", selected: false },
    { title: "tooltip", value: "tooltip", selected: false },
    { title: "avatar", value: "avatar", selected: false },
    { title: "badge", value: "badge", selected: false },
    { title: "separator", value: "separator", selected: false },
    { title: "skeleton", value: "skeleton", selected: false },
    { title: "table", value: "table", selected: false },
];

const onCancel = () => {
    console.log();
    console.log(pc.red("✖") + " Cancelled");
    process.exit(1);
};

export async function promptConfig(args) {
    if (args.yes) {
        return {
            projectName: args.projectName || "my-app",
            typescript: args.typescript ?? true,
            importAlias: "@/*",
            packageManager: args.packageManager || "npm",
            husky: args.husky ?? true,
            state: args.state || "redux",
            components: ["button", "card", "input", "label"],
        };
    }

    const questions = [];

    if (!args.projectName) {
        questions.push({
            type: "text",
            name: "projectName",
            message: "Project name:",
            initial: "my-app",
            validate: (v) => (isValidProjectName(v) ? true : "Invalid project name"),
        });
    }

    if (args.typescript === undefined) {
        questions.push({
            type: "toggle",
            name: "typescript",
            message: "Use TypeScript?",
            initial: true,
            active: "yes",
            inactive: "no",
        });
    }

    questions.push({
        type: "text",
        name: "importAlias",
        message: "Import alias:",
        initial: "@/*",
    });

    if (!args.packageManager) {
        questions.push({
            type: "select",
            name: "packageManager",
            message: "Package manager:",
            choices: [
                { title: "npm", value: "npm" },
                { title: "pnpm", value: "pnpm" },
                { title: "yarn", value: "yarn" },
                { title: "bun", value: "bun" },
            ],
            initial: 0,
        });
    }

    if (args.husky === undefined) {
        questions.push({
            type: "toggle",
            name: "husky",
            message: "Set up Husky + lint-staged (pre-commit hooks)?",
            initial: true,
            active: "yes",
            inactive: "no",
        });
    }

    if (!args.state) {
        questions.push({
            type: "select",
            name: "state",
            message: "State management:",
            choices: [
                { title: "Redux Toolkit", value: "redux" },
                { title: "Zustand", value: "zustand" },
                { title: "None", value: "none" },
            ],
            initial: 0,
        });
    }

    questions.push({
        type: "multiselect",
        name: "components",
        message: "Pre-install components:",
        choices: COMPONENT_CHOICES,
        hint: "(space to toggle, enter to confirm)",
        instructions: false,
    });

    const answers = await prompts(questions, { onCancel });

    return {
        projectName: args.projectName || answers.projectName,
        typescript: args.typescript ?? answers.typescript,
        importAlias: answers.importAlias || "@/*",
        packageManager: args.packageManager || answers.packageManager,
        husky: args.husky ?? answers.husky ?? true,
        state: args.state || answers.state || "redux",
        components: answers.components || [],
    };
}
