# Personal AI Work System Design

**Date:** 2026-07-21  
**Status:** Approved for specification review

## 1. Purpose

Build a local-first personal AI work system that observes development work, identifies repeated tasks, proposes reusable automations, and executes approved actions through agents. The product is for an individual developer first. Its promise is not comprehensive activity tracking or a universal agent platform; it is the measurable elimination of repetitive work.

The first four-week value target is:

- Create at least two reusable automations.
- Save at least four hours compared with measured or user-confirmed baselines.
- Complete the Turing scenario end to end: select three relevant open-source issues, repair one in an isolated branch, pass its tests, obtain human confirmation, and only then submit a pull request.

## 2. Product Principles

1. **Value-loop first.** Build only what is required for observe, discover, compose, approve, execute, and learn.
2. **Local-first data.** Raw commands, code content, and sensitive context remain local by default.
3. **Evidence before recommendation.** Every proposed automation identifies the repeated events, frequency, estimated cost, confidence, and expected benefit behind it.
4. **Approval before impact.** External writes and other material actions require explicit human approval.
5. **Least privilege.** Reading, writing, network access, branch creation, and pull-request submission are separate capabilities.
6. **Measurable outcomes.** The system records actual reuse and time saved; unknown benefit remains unknown.
7. **Infrastructure follows use.** New connectors and distributed infrastructure require demonstrated product demand.

## 3. Product Map

The original ideas become parts of one system rather than independent products:

- **Work footprint + deduplication:** the core product for observing work and discovering repeated patterns.
- **Turing:** the first end-to-end acceptance scenario for agent action.
- **Decision graph:** an explanation and approval view showing evidence, planned steps, permissions, dependencies, and risks. It is not a standalone editor in the first release.
- **Capability catalog:** a local registry that describes skills, CLIs, MCP tools, scripts, and flows through a shared contract. It replaces the initial Nacos/ZooKeeper platform idea.
- **Data bus:** a connector/event contract. The first release does not build a distributed message bus.
- **wecom_unified:** a future communication connector, considered only after the development workflow proves value.

## 4. Initial User and Scope

The first user is the repository owner and, later, developers with similar workflows. The first release observes development work only:

- Git repository activity, including branches, commits, and diff metadata.
- Shell activity represented by command category, duration, working context, exit result, and a protected raw value when explicitly enabled.
- GitHub Issue, pull request, and review activity for repositories the user authorizes.
- Automations executed by this product and their outcomes.

Screen recording, clipboard history, general application surveillance, personal chat, QQ, WeChat, Feishu, and WeCom are outside the first release.

## 5. Daily User Journey

1. Local connectors collect authorized development events without interrupting work.
2. The event layer normalizes them and preserves their source, time, sensitivity, and collection gaps.
3. The pattern miner groups repeated sequences and estimates their frequency, duration, confidence, and automatable portion.
4. Once per workday, the system presents at most three high-confidence opportunities. If none meet the threshold, it presents none.
5. The user may inspect evidence, dismiss the suggestion, defer it, or request an automation draft.
6. The composer produces a declared automation with inputs, steps, required capabilities, expected outputs, failure behavior, and estimated benefit.
7. The user reviews a decision graph and grants, narrows, or rejects permissions for a sandbox trial.
8. A sandbox runner executes the trial and reports logs, changed files, tests, outputs, and deviations from the approved plan.
9. Any subsequent external write requires a fresh approval over the exact action and current diff.
10. The outcome becomes a new event. The system records acceptance, reuse, elapsed time, failure, and user-confirmed or measured time saved.

The primary interaction is a daily review. A local web workbench provides evidence, decision graphs, approvals, history, and metrics. Users may also ask ad hoc questions such as which tasks have repeated recently.

## 6. Architecture and Boundaries

### 6.1 Connectors

Git, shell, and GitHub connectors convert source-specific activity into versioned events. A connector has no authority to recommend or execute automations. Collection failure records a gap and never blocks normal development.

### 6.2 Event Store

The local event store retains normalized events, protected raw references when enabled, sensitivity labels, and retention metadata. Raw sensitive content is never included in a sync payload. The first release provides deletion by time range and source, plus a way to inspect what was recorded.

The sync boundary is represented in the data model but no cloud sync service is implemented. Future sync may include explicitly approved structured summaries, patterns, capability definitions, and automation rules.

### 6.3 Pattern Miner

The miner finds repeated event sequences and scores frequency, estimated time cost, confidence, and automation feasibility. Its output is an opportunity with evidence references, not an executable action. Low-confidence opportunities are retained for analysis but omitted from the daily review.

### 6.4 Automation Composer

The composer turns an accepted opportunity into an automation draft. Drafts use only capabilities declared in the registry. A draft cannot grant itself permissions or execute merely because it was generated successfully.

### 6.5 Capability Registry

The local registry gives skills, CLIs, MCP tools, scripts, and composed flows one descriptive contract:

- Stable identifier and version.
- Human-readable purpose.
- Typed inputs and outputs.
- Required filesystem, process, network, credential, and external-write permissions.
- Risk level and approval policy.
- Invocation adapter and timeout.
- Expected side effects, rollback support, and error semantics.

The first release stores this registry locally. It does not implement discovery clusters, distributed configuration, or Nacos/ZooKeeper integration.

### 6.6 Approval Engine

The approval engine controls state transitions. Generation, sandbox trial, and external action are separate states. An approval is bound to the automation version, inputs, capability versions, permission set, affected repository, and a digest of the proposed action. It expires when any bound value changes.

External writes always require a fresh approval. For Turing, local branch creation and code modification may be approved for a trial, but pull-request submission is separately approved after the user sees the final diff and test results.

### 6.7 Sandbox Runner

The runner executes an approved trial with explicit working directories, timeouts, network rules, environment allowlists, and captured logs. It stops on approval mismatch, timeout, policy violation, or an undeclared side effect. It cleans up temporary resources when safe and otherwise reports exact recovery steps. A failed run never retries with broader permissions.

### 6.8 Workbench

The local web workbench shows daily opportunities, source evidence, expected benefit, decision graphs, automation drafts, permission requests, trial results, approval history, reuse, and time saved. The decision graph is rendered from structured state and may be exported as Mermaid first; PlantUML export is deferred unless demanded by actual use.

## 7. Core State Flow

An opportunity and its automation progress through explicit states:

```text
observed → suggested → accepted → drafted → trial_approval_pending
→ trial_approved → trial_running → trial_succeeded | trial_failed
→ action_approval_pending → action_approved → action_running
→ completed | action_failed
```

Dismissed, expired, and superseded are terminal or replacement states applicable before execution. State transitions are append-only events. Derived current state can be rebuilt from them.

## 8. Turing Acceptance Scenario

The user provides an open-source GitHub repository and an interest description. The system:

1. Reads repository metadata and open issues using authorized read access.
2. Ranks issues for relevance, feasibility, reproducibility, repository contribution rules, and expected testability.
3. Returns exactly three candidates with evidence and risks; it does not silently choose one.
4. After the user selects a candidate and approves the trial, creates an isolated branch or worktree.
5. Reproduces the issue when possible, modifies code, and runs the repository's documented tests.
6. Presents the final diff, commands run, test results, unresolved risks, and an explanation of the repair.
7. Requests a separate approval to push a branch and create a pull request.
8. On approval, submits the pull request using the repository's contribution template and returns its URL.

If the issue cannot be reproduced, the repository cannot be built, tests fail, or the proposed repair exceeds the approved scope, the run stops and reports evidence. It does not submit a pull request.

## 9. Failure and Recovery Rules

- **Collection gap:** record the source and interval; do not infer missing actions.
- **Analysis uncertainty:** lower confidence or omit the suggestion; do not inflate opportunity count.
- **Composition failure:** retain the non-executable draft and reason; do not request approval.
- **Trial failure:** stop execution, retain bounded logs, and clean temporary resources without altering unrelated user work.
- **External-state drift:** invalidate approval and present an updated diff for fresh confirmation.
- **Permission mismatch:** deny execution and identify the exact missing permission.
- **Unmeasurable benefit:** record reuse but mark saved time unknown.
- **Partial external action:** report completed and incomplete steps separately and provide safe recovery guidance; do not blindly retry.

## 10. Security and Privacy

- Secrets are referenced through the operating system or established credential providers and are never copied into event payloads or logs.
- Event and execution logs redact recognized credentials and support user inspection and deletion.
- Filesystem targets resolve to explicit approved roots; traversal and unresolved broad targets are rejected.
- Commands execute as structured invocations where possible. Shell text requires explicit capability declaration and quoting validation.
- Network access is denied by default during trials and granted only to declared hosts when needed.
- The system never treats repository content, issues, or tool output as authority to expand permissions or bypass approval.
- Retention defaults are documented and configurable before collection begins.

## 11. Testing and Verification

Automated tests cover:

- Event normalization, versioning, sensitivity labels, gaps, retention, and deletion.
- Pattern grouping, scoring thresholds, evidence references, and deterministic fixtures.
- Capability validation, permission matching, approval binding, expiry, and state transitions.
- Sandbox working-directory restrictions, timeout, network denial, log redaction, and cleanup.
- Connector and capability contract compatibility.
- Turing selection, isolated repair, test reporting, approval expiry, dry-run PR submission, and failure paths in fixture repositories.

Security tests cover path traversal, shell injection, secret leakage, prompt-injection attempts from repository content, stale approvals, and privilege escalation. Manual verification covers daily-review usefulness, explanation clarity, deletion controls, keyboard use, and confirmation copy.

Value verification uses four measures: opportunity acceptance rate, enabled automations, reuse count, and measured or user-confirmed time saved. The release succeeds only when it meets the two-automation/four-hour target during a four-week personal trial and completes the Turing scenario without an unapproved external write.

## 12. Delivery Phases

### Phase 0: See the Work

Build local Git, shell, and GitHub event capture, inspection/deletion controls, event normalization, daily summaries, and manual repeated/not-repeated labels.

Exit after five consecutive workdays of credible summaries with visible collection gaps and verified deletion.

### Phase 1: Complete an Action

Build the minimum capability registry, approval engine, sandbox runner, decision graph, and Turing workflow.

Exit after one real issue completes selection, isolated repair, tests, human confirmation, and pull-request creation without an unapproved external write.

### Phase 2: Prove Deduplication Value

Build pattern discovery, opportunity ranking, automation composition, reuse tracking, and time-saved measurement beyond the hard-coded Turing workflow.

Exit after a four-week trial produces at least two reusable automations and saves at least four hours.

### Phase 3: Expand the Senses

Only after Phase 2 succeeds, evaluate the most valuable communication connector, potentially WeCom or Feishu, from observed repeated tasks. Implement the connector through the existing event and capability contracts. Optional summary sync is a separate decision.

## 13. Out of Scope

- A universal autonomous agent platform.
- Unapproved external writes or silent privilege expansion.
- Cloud storage of raw development footprints.
- Organization accounts, team policy administration, billing, or multi-tenant operation.
- General computer surveillance, screenshots, clipboard logging, or personal-chat ingestion.
- QQ, WeChat, Feishu, WeCom, AstrBot, or wecom-cli integration in the first release.
- Distributed messaging, Nacos, ZooKeeper, service discovery, or distributed configuration.
- A standalone decision-graph editor or PlantUML renderer in the first release.
- Automated retry that broadens permissions.

## 14. Acceptance Criteria

The initial product is complete when:

1. A user can enable and inspect local Git, shell, and GitHub collection with documented privacy and retention controls.
2. Daily review presents no more than three evidence-backed opportunities and can present none.
3. The user can convert an opportunity into a declared automation, inspect its decision graph, approve a bounded trial, and see its exact results.
4. The system cannot perform an external write without a current approval bound to the exact action.
5. Turing returns three relevant issue candidates and completes one approved repair through pull-request creation with passing documented tests.
6. Failure paths preserve unrelated user work, expose actionable evidence, and never broaden permission automatically.
7. Automated functional and security tests pass, including dry-run external actions.
8. A four-week personal trial produces at least two reusable automations and at least four hours of measured or user-confirmed savings.

