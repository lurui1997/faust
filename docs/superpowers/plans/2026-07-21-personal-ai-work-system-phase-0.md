# Personal AI Work System Development Plan

**Date:** 2026-07-21

**Goal:** Build a local-first personal AI work system that helps one developer notice repeated work, turn the right repetitions into reusable automations, and measure whether the system actually saves time.

## First Principles

1. **The product is not an agent platform.** The product is a loop for eliminating repeated work: observe, explain, approve, execute, learn.
2. **Trust is the scarce resource.** The system should start by observing safely and explaining clearly before it earns permission to act.
3. **Local-first is a product feature, not an implementation detail.** Raw work data stays local by default. External writes require explicit approval.
4. **Evidence beats cleverness.** A recommendation is only useful when it shows the repeated events, frequency, confidence, expected benefit, and risk.
5. **The smallest real loop wins.** Prefer one narrow workflow that runs daily over a large architecture that cannot prove value.
6. **Measure saved time honestly.** Unknown savings stay unknown. Estimated and measured savings must be labeled separately.

## Product Shape

The system should evolve as one product with four layers:

- **Observation:** collect authorized development metadata from Git, shell activity, GitHub, and later selected communication tools.
- **Understanding:** normalize events, preserve collection gaps, identify repeated work, and explain why something looks automatable.
- **Action:** draft automations, show required permissions, run bounded trials, and require fresh approval for external impact.
- **Learning:** record acceptance, dismissal, reuse, failures, and time saved so future suggestions become more useful.

## Phase 0: See the Work

Purpose: make work visible without creating automation risk.

Build:

- Local event model for Git, shell metadata, GitHub activity, and collection gaps.
- Local event store with inspect, delete, and retention controls.
- Daily review that shows at most three evidence-backed opportunities, or none.
- Manual labels for repeated/not-repeated suggestions.
- Clear privacy documentation before collection.

Do not build:

- Autonomous execution.
- Pull request creation.
- General computer surveillance.
- Clipboard, screenshots, chats, or file-content capture.
- Cloud sync.

Exit criteria:

- Five consecutive workdays of credible daily summaries.
- Visible collection gaps when a source cannot be read.
- Verified deletion by source and date range.
- Retention behavior is documented and testable.
- At least one suggestion is manually labeled and reflected in later review.

## Phase 1: Complete One Approved Action

Purpose: prove the system can act safely once, under human control.

Build:

- Minimal capability registry.
- Approval state machine.
- Sandbox runner.
- Decision graph for planned action, permissions, risks, and expected outputs.
- Turing workflow: rank three relevant open-source issues, repair one in isolation, run tests, show diff, then request separate approval before any PR.

Exit criteria:

- One real issue completes selection, isolated repair, tests, human confirmation, and pull request creation.
- No external write happens without current approval bound to the exact action.
- Failure paths stop cleanly and preserve unrelated user work.

## Phase 2: Prove Deduplication Value

Purpose: show the system is worth keeping.

Build:

- Reusable automation drafts from accepted opportunities.
- Reuse tracking.
- Time-saved measurement with provenance.
- Opportunity ranking tuned by labels and outcomes.

Exit criteria:

- Four-week personal trial.
- At least two reusable automations created.
- At least four hours saved, measured or explicitly user-confirmed.
- Acceptance, dismissal, failure, and reuse are visible in the workbench.

## Phase 3: Expand the Senses

Purpose: add more sources only after the development workflow proves value.

Consider:

- WeCom or Feishu connector.
- Communication-derived repeated-work signals.
- Optional structured summary sync.

Do not add these until Phase 2 has demonstrated real value.

## Engineering Direction

Keep the implementation boring and auditable:

- Plain local files before databases.
- Structured events before models.
- Deterministic scoring before learned ranking.
- CLI before web workbench.
- Dry-run before execution.
- Explicit permissions before side effects.

The current `projects/personal-ai-work-system` CLI prototype should become the seed of Phase 0, not the final architecture. Its next evolution is to split observation, storage, review, and rendering into clear modules while preserving the current simple command-line experience.

## Near-Term Sequence

1. Stabilize Phase 0 event contracts and local storage.
2. Add Git, shell metadata, GitHub, and collection-gap ingestion.
3. Add inspect, delete, retention, and manual labels.
4. Make daily review read from stored events and show gaps.
5. Run the system personally for five workdays.
6. Only then decide whether to enter Phase 1.

## Key Risks

- Collecting too much data will make the product feel unsafe.
- Acting too early will damage trust.
- Building infrastructure before proving the loop will slow the project down.
- Measuring time saved loosely will create false confidence.
- Treating “interesting agent behavior” as success will distract from the real metric: repeated work removed.
