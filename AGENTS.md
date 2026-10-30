# Project instructions

For structural codebase exploration, use the installed `codebase-memory` skill.

## Android release checks

Run Android emulators on the Insight VPS (`13.140.89.146`), never on the user's local PC. Prefer the existing VPS build toolchain to avoid local memory pressure. Keep tests isolated from production data and stop test processes after verification. See `DEPLOYMENT.md` for release paths and validation.

## Obsidian vault

After deployments, releases, server or service changes, and non-trivial bug fixes, read `C:\Users\shayan\Documents\projects\obsidian\AGENTS.md`, update the vault as directed, and commit only the vault files changed. Never write secrets into the vault. Skip routine code edits.
