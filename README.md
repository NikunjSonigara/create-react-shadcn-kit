# create-react-shadcn-kit

[![npm version](https://img.shields.io/npm/v/create-react-shadcn-kit.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/create-react-shadcn-kit)
[![npm downloads](https://img.shields.io/npm/dm/create-react-shadcn-kit.svg)](https://www.npmjs.com/package/create-react-shadcn-kit)
[![license](https://img.shields.io/npm/l/create-react-shadcn-kit.svg)](./LICENSE)

> Create a React (Vite) app with **shadcn/ui** pre-integrated — zero config.

One command, a fresh Vite + React project, Tailwind configured, shadcn/ui initialized, path aliases wired, and your favorite components already installed. No juggling three CLIs.

## Usage

```bash
npx create-react-shadcn-kit@latest
```

Or pass a name directly:

```bash
npx create-react-shadcn-kit my-app
```

## What it does

1. Scaffolds a fresh Vite + React app via `create-vite@latest` (TypeScript or JavaScript).
2. Installs and wires up **Tailwind CSS v4** via `@tailwindcss/vite`.
3. Configures `@/*` path aliases in `vite.config`, `tsconfig.json`, and `tsconfig.app.json`.
4. Runs `shadcn@latest init` inside the new project.
5. Pre-installs the shadcn components you selected.
6. Wires up state management — **Redux Toolkit** (default) or **Zustand**, with a sample store and (for Redux) `<Provider>` already wrapping `<App />` in `main.tsx`.
7. (Optional) Sets up **Husky + lint-staged + Prettier** with a pre-commit hook that runs `eslint --fix` and `prettier --write` on staged files.

You skip the "install Vite → add Tailwind → patch configs → read shadcn docs → run init → add components one by one" ritual.

## Options

| Flag                                    | Description                         |
| --------------------------------------- | ----------------------------------- |
| `-y, --yes`                             | Skip prompts, use sensible defaults |
| `--ts` / `--js`                         | TypeScript (default) or JavaScript  |
| `--npm` / `--pnpm` / `--yarn` / `--bun` | Pick your package manager           |
| `--no-husky`                            | Skip Husky + lint-staged setup      |
| `--state=<lib>`                         | `redux` (default), `zustand`, `none`|
| `-v, --version`                         | Print version                       |
| `-h, --help`                            | Show help                           |

## Examples

```bash
# Fully interactive
npx create-react-shadcn-kit

# Non-interactive with defaults
npx create-react-shadcn-kit my-app --yes

# Use pnpm
npx create-react-shadcn-kit my-app --pnpm
```

## Requirements

- Node.js **18.17+**
- Network access (to fetch `create-vite` and `shadcn`)

## Development

```bash
git clone https://github.com/NikunjSonigara/create-react-shadcn-kit.git
cd create-react-shadcn-kit
npm install
node bin/index.js test-app --yes
```

## Contributing

Issues and PRs welcome at [github.com/NikunjSonigara/create-react-shadcn-kit](https://github.com/NikunjSonigara/create-react-shadcn-kit).

## License

MIT
