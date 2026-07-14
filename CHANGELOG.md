# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Scaffolded projects now start with an initial git commit.** After setup
  completes, the generated project is committed (`setup the project with the
  create-react-shadcn-kit`) so it begins from a clean, tracked baseline. The
  commit runs with `--no-verify` so the freshly-installed pre-commit hook can't
  block it, and is best-effort — if no git identity is configured it is skipped
  with a warning instead of failing the scaffold.

### Fixed

- **yarn scaffolds no longer abort at the Husky step.** `lint-staged`'s latest
  major (17) requires Node ≥22.22.1 — above this kit's declared floor
  (Node ≥22.0.0). npm, pnpm, and bun only warn on that `engines` mismatch and
  install it anyway, but Yarn Classic treats it as a hard error and aborts the
  install (`error lint-staged@17.0.8: The engine "node" is incompatible with
  this module. Expected version ">=22.22.1"`). `lint-staged` is now pinned to
  `^16` (needs only Node ≥20.17), so the installed toolchain matches the
  supported Node range for every package manager — not just yarn. Yarn installs
  additionally pass `--ignore-engines` so Yarn Classic's strict engine checking
  can't spuriously abort the scaffold on a Node range the kit already supports.

### Changed

- **Internal refactor (no behavior change):** the Redux, Zustand, and
  Husky/Prettier file contents were extracted from `scaffold.js` into real,
  lintable files under `templates/`. The generated output is byte-for-byte
  identical.

## [0.3.1] - 2026-07-02

### Fixed

- **pnpm projects: end-user `pnpm install` no longer fails.** Scaffolded pnpm
  apps now ship a valid `pnpm-workspace.yaml` that resolves pnpm 11's
  `ERR_PNPM_IGNORED_BUILDS` for the dependency build scripts Vite pulls in
  (`esbuild`). Unlike `create-next-app`, `create-vite` leaves no such file
  behind, so we create one with an explicit, valid decision.

## [0.3.0] - 2026-07-01

### Changed

- **BREAKING: minimum Node.js is now 22** (was 18). The generated app's
  toolchain requires it — Vite 7 needs Node 20.19+/22.12+, pnpm 11's binary
  needs `node:sqlite` (Node ≥22.13), and lint-staged's listr2 requires
  Node ≥22.13. `engines`, the runtime check, and the docs were updated to match.

### Fixed

- **pnpm 11:** the scaffold no longer aborts during install with
  `ERR_PNPM_IGNORED_BUILDS` (pnpm 11 defaults `strictDepBuilds=true`).
- **Husky setup in any folder:** the project is `git init`-ed before Husky runs
  when it isn't already its own repository, so the hook setup doesn't fail.

### Added

- Continuous integration on every push/PR: unit tests on Node 22/24 plus an
  end-to-end scaffold-and-build across npm, pnpm, yarn, and bun.

## [0.2.0] - 2026-07-01

### Fixed

- **Argument parsing:** boolean flags no longer consume the project name. Orders
  like `create-react-shadcn-kit --pnpm my-app` and `--no-husky my-app` now keep
  `my-app` as the project name.
- **Project name validation** now runs on every path (including `--yes` and a
  name passed directly as an argument), rejecting invalid names and path
  traversal before any file system or process operation.
- **Import alias:** the alias prefix used by the Vite config and the Redux
  provider wiring is derived from the chosen import alias via a shared,
  testable helper instead of ad-hoc string slicing.

### Added

- Unit test suite (`node --test`) covering argument parsing, name validation,
  and the import-alias helper.
- The publish workflow now runs `npm test` before publishing.

## [0.1.1] - 2026-04-21

### Added

- npm publishing via OIDC trusted publisher, package metadata, and README
  badges.
- Scaffolder support across all package managers (npm, pnpm, yarn, bun).

## [0.1.0] - 2026-04-20

### Added

- Initial release: scaffold a React (Vite) app with shadcn/ui pre-integrated,
  with optional state management (Redux Toolkit or Zustand) and Husky +
  lint-staged + Prettier setup.

[Unreleased]: https://github.com/NikunjSonigara/create-react-shadcn-kit/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/NikunjSonigara/create-react-shadcn-kit/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/NikunjSonigara/create-react-shadcn-kit/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/NikunjSonigara/create-react-shadcn-kit/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/NikunjSonigara/create-react-shadcn-kit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/NikunjSonigara/create-react-shadcn-kit/releases/tag/v0.1.0
