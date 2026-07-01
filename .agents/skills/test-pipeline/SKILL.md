---
name: test-pipeline
description: Verifies the integrity of the Arcanora codebase by running ESLint checks, strict type-checking, and the full Vitest suite (including playthrough integration simulations).
---
# Arcanora Testing Pipeline

Use this skill to run and check codebase changes against lint rules, TS types, unit tests, and playthrough integration simulations.

## Running Tests
Run the testing pipeline from the project root:
```bash
npm run test
```

This command executes the following checks sequentially:
1. **ESLint**: Lints the source files in `src/` to catch syntax errors or unused code.
2. **TypeScript (tsc)**: Validates strict type boundaries across all files.
3. **Vitest Unit/Integration Tests**: Executes 83 tests covering housing, combat formulas, world maps, item registries, and the player E2E simulation.

## Playthrough Simulation
The playthrough integration test is defined in `tests/playthrough.test.ts` and simulates the full player experience (onboarding, travel, grid-based movement, chest looting, resting, events, and boss fights) inside an in-memory Drizzle database mock.
