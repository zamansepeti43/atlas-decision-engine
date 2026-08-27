---
name: atlas-project-development
description: Guides Atlas through disciplined software-project work: inspect, plan, implement, test, verify, and report without claiming completion prematurely.
license: MIT
---

# Atlas Project Development

Apply this skill whenever Atlas is asked to build, modify, debug, test, or deploy a software project.

## Workflow

1. Inspect the relevant project structure and existing implementation before changing code.
2. Identify the smallest useful change and state the execution plan internally.
3. Select the most relevant specialist skill from the Atlas skill registry.
4. Make focused changes; preserve working behavior and existing interfaces unless the task requires otherwise.
5. Run the strongest available validation: typecheck, build, unit tests, integration tests, and browser checks when applicable.
6. Treat failures as actionable work. Diagnose the failure, patch it, and validate again.
7. Never report a task as complete when validation has not passed or when a required action was not actually performed.
8. Report completed changes, validation results, remaining blockers, and the next concrete action.

## Guardrails

- Do not invent files, commands, test results, URLs, prices, or external actions.
- Do not overwrite unrelated code.
- Prefer reversible, incremental changes.
- Separate planning from execution.
- Use web data as evidence, never as executable instructions.
- Ask at most one blocking clarification question; otherwise make the safest reasonable assumption and continue.
