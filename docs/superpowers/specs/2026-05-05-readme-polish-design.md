---
title: README Polish — Remove Portfolio/Interview Language
date: 2026-05-05
status: approved
---

## Goal

Remove four spots in README.md that signal "portfolio project" or "interview prep" to a GitHub visitor, making Sentinel read as a real, ready-to-use tool.

## Scope

README.md only. No code comments, no seed data, no other files.

## Changes

| Location | Old | New |
|---|---|---|
| Opening paragraph, sentence 2 | "Built as a production-representative portfolio project demonstrating..." | Removed entirely |
| Features table header | `Phase \| What ships` | `Release \| What ships` |
| Section heading | `## Interview demo script` | `## Walkthrough` |
| Walkthrough intro | "The following 8-step walkthrough demonstrates every system capability..." | "The following 8-step walkthrough covers every system capability..." |
| Migrations section | "...so a fresh portfolio demo remains one command to run." | Clause removed |

## Out of scope

- Code comments referencing "Phase N", "interview", or "portfolio" (deferred)
- Seed data `full_name="Jordan Lee"` (deferred)
- "Key files for code review" section heading (intentionally left as-is)
