# Implementation Plan — Workspace Overhaul (8 requests)

Status: **IMPLEMENTED.** Backend `pytest` green, frontend `npm run build` green.

Locked decisions (from approval):
1. **#4** — `user_repos` table **dropped entirely**. Replaced by an in-memory active-repo registry in `app/storage/user_stores.py` (reconstructs from pgvector chunk metadata after a restart). `repo_files` and chat-session tables were also dropped.
2. **#7** — coverage is **graph-estimated** (hot functions by call in-degree, coverage = test-caller ratio), labeled "estimated".
3. **#6/#7** — "Save to note" = **copy-to-clipboard** (markdown summary).

This plan covers the 8 changes requested. Each section has: **Root cause / current state → Proposed change → Files touched**. Two items carry an explicit **DECISION NEEDED** flag where the request collides with how the backend works today.

---

## 1. Fix "error when clicking a source" (404 on `/file`)

### Root cause
Citations and flow-tracer nodes store an **absolute clone path** (`f.file_path` from Neo4j / chunk metadata), e.g. `/tmp/repograph_fn3oanjb/tests/test_dependency_class.py`. That path is:
- The temp dir from a **previous** ingest — the log shows a click for `repograph_fn3oanjb/...` right after a fresh ingest created `repograph_a3x0h0m1/...`.
- Deleted after ingest anyway (`cleanup_repository` in the `finally` block of `ingest_repo`).

`get_repo_file_content` ([app/db/migrations.py:274](app/db/migrations.py#L274)) matches `repo_files.file_path` **exactly**, and the stored rows now use the *new* temp prefix, so the old absolute path 404s. Every ingest re-randomizes the prefix, so any citation minted before the last ingest is dead.

### Proposed change
This is **superseded by request #2** — instead of repairing the `/file` lookup, we drop the in-app viewer entirely and open the file on GitHub. See §2. (No point hardening a path-matching scheme we're about to delete.)

---

## 2. Remove the Code Explorer → open the file directly on GitHub (DeepWiki-style)

### Current state
- Clicking a citation ([CenterPanel.tsx:91](frontend/components/workspace/CenterPanel.tsx#L91)) or a flow-tracer node ([RightPanel.tsx:98](frontend/components/workspace/RightPanel.tsx#L98)) calls `openCodeViewer(file_path, line, repoId)`, which flips `centerTab` to `explorer` and drives `CodeExplorer` via `/files` + `/file`.
- `CodeExplorer` ([CodeExplorer.tsx](frontend/components/workspace/CodeExplorer.tsx)) is a full Shiki-highlighted in-app viewer.

### Proposed change
Replace the in-app viewer with a GitHub deep-link. Clicking a source opens a new tab at:
```
{repo_url}/blob/{commit_sha}/{relative_path}#L{line}
```

Steps:
1. **Backend — expose commit SHA + relative path.**
   - Add `commit_sha` to the `/ingest-repo` response ([app/routes/repo.py:183](app/routes/repo.py#L183)) and the skip branch ([:143](app/routes/repo.py#L143)). Value = `remote_sha or existing["commit_sha"]`.
   - In citation building ([app/services/rag_service.py:112](app/services/rag_service.py#L112) and [:164](app/services/rag_service.py#L164)), add a `rel_path` field computed via `_to_relative_path(file_path)` so the frontend never has to parse temp prefixes. (Flow-tracer nodes already carry `file`/`file_path`; add `rel_path` there too in [app/services/flow_tracing_service.py](app/services/flow_tracing_service.py).)
2. **Frontend store — replace viewer state with a GitHub opener.**
   - In [store/workspace.ts](frontend/store/workspace.ts): remove `codeViewerState`, `openCodeViewer`, `CodeViewerState`, and the `CenterTab` `'explorer'` member. Add `commitSha` to `RepoInfo`.
   - Add a pure helper `githubBlobUrl(repo)` in a small util (e.g. `frontend/lib/github.ts`) that builds the URL from `currentRepo.url`, `currentRepo.commitSha` (fallback `HEAD`), a relative path, and a line.
3. **Frontend components.**
   - Citation chip ([CenterPanel.tsx:85-104](frontend/components/workspace/CenterPanel.tsx#L85-L104)): `onClick` → `window.open(githubBlobUrl(...), '_blank')`. Use `c.rel_path` (fallback: strip prefix client-side).
   - Flow-tracer node ([RightPanel.tsx:98](frontend/components/workspace/RightPanel.tsx#L98)): same treatment; keep the `ExternalLink` affordance.
   - Delete the `explorer` tab and `CodeExplorer` mount in [CenterPanel.tsx:332-368](frontend/components/workspace/CenterPanel.tsx#L332-L368); the center panel becomes chat-only (drop the tab bar or keep a single "Chat" header).
4. **Delete dead code.**
   - `frontend/components/workspace/CodeExplorer.tsx`, `frontend/hooks/useShikiLines.ts` (if unused elsewhere — verify), and the `fileTree`/`fileContent` api methods ([lib/api.ts:227-235](frontend/lib/api.ts#L227)).
   - Backend `app/routes/files.py` + its `include_router(files_router)` in [app/main.py:79](app/main.py#L79). `get_repo_file_tree` / `get_repo_file_content` in migrations become unused → remove.
   - **Keep** `repo_files` table population during ingest **only if** `_get_readme_for_repo` still needs it ([onboarding_service.py:20](app/services/onboarding_service.py#L20)). It reads README from `repo_files` — so keep the table + write path, just drop the tree/content read routes.

### Files touched
`app/routes/repo.py`, `app/routes/files.py` (delete), `app/main.py`, `app/services/rag_service.py`, `app/services/flow_tracing_service.py`, `frontend/store/workspace.ts`, `frontend/lib/api.ts`, `frontend/lib/github.ts` (new), `frontend/components/workspace/CenterPanel.tsx`, `frontend/components/workspace/RightPanel.tsx`, `frontend/components/workspace/CodeExplorer.tsx` (delete).

---

## 3. Fix Onboarding entry-point detection (test files wrongly flagged "minimal dependencies")

### Root cause
[onboarding_service.py:58](app/services/onboarding_service.py#L58) (and the streaming twin at [:124](app/services/onboarding_service.py#L124)):
```python
if len(imports) <= 2 and func_names: reasons.append("minimal dependencies")
```
Test files typically import 1–2 things, so every `test_*.py` gets tagged as a low-dependency "entry point." That's semantically wrong — tests are leaves, not entry points.

### Proposed change
Rewrite the entry-point heuristic in **both** `generate_onboarding_guide` and `stream_onboarding_guide`:
- **Exclude test files**: skip any file where `"test" in path.lower() or "spec" in path.lower()` (mirrors the `is_test` rule in [neo4j.py:88](app/db/neo4j.py#L88)) and skip vendored paths (reuse the `_SKIP_PATHS` list).
- **Drop the "minimal dependencies" signal** entirely — it has no correlation with being an entry point.
- **Strengthen real signals**: `has main function`, `has __main__ block`, `route entry point` (APIRouter/FastAPI/Flask), plus filename-based signals (`main.py`, `app.py`, `manage.py`, `cli.py`, `index.ts`, `server.ts`, `__main__.py`).
- Factor the shared logic into one helper (e.g. `_detect_entry_points(graph)`) so the sync and streaming paths can't drift.

### Files touched
`app/services/onboarding_service.py`.

---

## 4. Remove "store repositories" (only the current ingested repo stays in context)

### DECISION NEEDED
The backend `user_repos` table is **load-bearing**, not just history UI: every tool resolves the active repo through `_get_latest_repo` → `get_user_repos` ([graph_retrieval_service.py:40](app/services/graph_retrieval_service.py#L40)), which powers dead-code, test-coverage, architecture, onboarding, flow-trace, and RAG graph expansion. We cannot delete the table without breaking all of them.

**Recommended interpretation:** remove the *persistent multi-repo library / history* concept from the UX — no history list, no auto-restore of old repos across sessions, no multi-repo "context" selection. The backend keeps exactly **one** active repo row (which ingest already overwrites/clears per repo). The active repo is effectively session-scoped from the user's point of view.

### Proposed change (frontend-only)
- **Store** ([store/workspace.ts](frontend/store/workspace.ts)): remove `repoHistory`, `setRepoHistory`, `deleteRepo`, `contextRepos`, `toggleContextRepo`, `setContextRepos`. `currentRepo` stays (session-only; already not persisted).
- **LeftPanel** ([LeftPanel.tsx](frontend/components/workspace/LeftPanel.tsx)):
  - Delete the "History" block ([:263-328](frontend/components/workspace/LeftPanel.tsx#L263-L328)), `repoStatuses`, the `myRepos()` load-on-mount + auto-restore effect ([:48-71](frontend/components/workspace/LeftPanel.tsx#L48-L71)), and the "include in chat context" toggles.
  - Repos tab reduces to: ingest input + token input + **active repo stats** card.
- **Requests**: `contextRepos` no longer sent as `repo_ids` — RAG/agent always target the current repo (pass `currentRepo.repoId`, or `[]` to mean "the one active repo"). Update `send()` in [CenterPanel.tsx:279](frontend/components/workspace/CenterPanel.tsx#L279).
- **Backend cleanup (optional):** `/my-repos` and `DELETE /repo/{id}` become unused; can be left in place or removed. Recommend leaving `/my-repos` removed from the frontend but keeping the route (harmless) to minimize churn.

### Files touched
`frontend/store/workspace.ts`, `frontend/components/workspace/LeftPanel.tsx`, `frontend/components/workspace/CenterPanel.tsx`, `frontend/lib/api.ts` (drop `myRepos`/`repoStatus` usage).

---

## 5. Remove chat history (persistent sessions) — keep in-conversation memory

### Current state
- **In-conversation memory already exists** and is exactly what should be kept: `buildHistory()` sends the last 8 messages with every request ([CenterPanel.tsx:236](frontend/components/workspace/CenterPanel.tsx#L236)). This is independent of the DB.
- **Persistent history** = the `/sessions` API + the Chats tab: `ensureSession`, `saveMessage`, `loadSession`, session list ([chat_sessions.py](app/routes/chat_sessions.py), [LeftPanel.tsx:342-406](frontend/components/workspace/LeftPanel.tsx#L342-L406)).

### Proposed change
- Remove session **persistence & listing**, keep ephemeral messages + `buildHistory`:
  - **CenterPanel**: strip `ensureSession`, `saveMessage`, `currentSessionId`, `addSession`, `updateSessionTitle` calls from `send()` ([:241-326](frontend/components/workspace/CenterPanel.tsx#L241-L326)). Messages stay in Zustand (session-only) and history is still threaded — so the model still "remembers" the ongoing conversation.
  - **LeftPanel**: delete the entire **Chats** tab ([:342-406](frontend/components/workspace/LeftPanel.tsx#L342-L406)) and its `loadSession`/`newChat`/`deleteSession` handlers + the sessions load effect ([:73-78](frontend/components/workspace/LeftPanel.tsx#L73-L78)). Left panel tabs become `repos` + `pr`.
  - **Store**: remove `sessions`, `currentSessionId`, `setSessions`, `addSession`, `removeSession`, `updateSessionTitle`, `setCurrentSessionId`. Keep `clearMessages` (New-chat / trash button in CenterPanel header still works, just no DB).
  - **api.ts**: remove the `sessions` block ([:255-269](frontend/lib/api.ts#L255)).
  - **Backend (optional):** `app/routes/chat_sessions.py` + `include_router(sessions_router)` ([main.py:80](app/main.py#L80)) and the `chat_sessions`/`chat_messages` migrations can be removed. Recommend removing the router registration and leaving the table definitions dormant to reduce migration risk.

### Files touched
`frontend/components/workspace/CenterPanel.tsx`, `frontend/components/workspace/LeftPanel.tsx`, `frontend/store/workspace.ts`, `frontend/lib/api.ts`, (optional) `app/main.py`, `app/routes/chat_sessions.py`.

---

## 6. Dead Code Finder — redesign to match the mockup

### Mockup spec (image 1)
- Header line: **"N symbols have zero incoming calls in the graph — candidates for removal."**
- Flat list of rows (not the current file-grouped accordion): each row = a **file chip** (colored, left) + `symbol() · N callers` (right). Callers is `0` for every dead symbol by definition.
- A **"Save to note"** pinned button at the bottom.

### Current state
`analyze_dead_code` returns `{total, by_file: [{file, functions:[{name,line}]}], message}` ([dead_code_service.py](app/services/dead_code_service.py)); `AnalysisView` renders a collapsible per-file list ([RightPanel.tsx:317-365](frontend/components/workspace/RightPanel.tsx#L317)).

### Proposed change
- **Backend**: return a **flat symbol list**. New shape:
  ```json
  { "total": 4,
    "symbols": [{ "file": "planner_agent.py", "symbol": "plan_steps", "callers": 0, "rel_path": "...", "line": 12 }] }
  ```
  `callers` is always 0 here (query already selects `NOT ()-[:CALLS]->(f)`), but include it so the UI can render "0 callers" verbatim and so we can later relax to "≤N callers." Add `rel_path` for the GitHub deep-link (§2).
- **Frontend**: replace the shared `AnalysisView` for `deadcode` with a dedicated `DeadCodeView`:
  - Header sentence as in the mockup.
  - One card per symbol: `file.py` chip in an accent/red tone + `symbol() · N callers`. Clicking opens the symbol on GitHub (§2).
  - **"Save to note"** button → see shared behavior below.

### "Save to note" behavior (shared by §6 & §7)
Define it as: append a formatted **assistant message** into the current chat (`addMessage`) summarizing the finding as markdown (title + bullet list). This keeps it in the ongoing conversation memory and is visible/scrollable. (Alternative: copy-to-clipboard toast — call out at review.)

### Files touched
`app/services/dead_code_service.py`, `app/db/neo4j.py` (add `rel_path`/keep `callers`), `frontend/components/workspace/RightPanel.tsx`, `frontend/store/workspace.ts` (a `saveToolNote` action).

---

## 7. Test Coverage — redesign to match the mockup

### Mockup spec (image 2)
- Header: **"Coverage across the ingestion + retrieval path. N hot functions have no tests."**
- Rows show a **per-function coverage percentage**: `scan_repository 0% · no tests`, `stream_rag_response 42%`, `bm25_search 88% ✓`, `chunking_service.enrich 0% · no tests`.
- Percentage-driven styling: 0% = "no tests" (warn), high = ✓ (success).
- **"Save to note"** button.

### Root cause / gap
Current backend only returns a **binary** untested list ([test_coverage_service.py](app/services/test_coverage_service.py)) — no percentage, no ranking. The mockup needs a coverage % and a notion of "hot functions."

### Proposed change (heuristic coverage %)
We don't run `coverage.py`; we approximate from the call graph. Proposed metric per production function `f`:
- **Hot functions** = production functions ranked by in-degree (total incoming `CALLS`), take top N (e.g. 15). These are the "hot path."
- **Coverage %** = `round(100 * test_callers / total_callers)` where `test_callers` = distinct `is_test` functions calling `f` (directly, optionally 1–2 hops transitive), `total_callers` = distinct callers. `total_callers == 0` → treat as `0%`.
- **Label**: `0%` → "no tests"; `>= 80%` → append `✓`.

New Cypher (in `neo4j.py`) returns `[{name, rel_path, line, coverage, test_callers, total_callers}]` ordered by in-degree desc. Keep the existing `_SKIP_PATHS` filter and `NOT is_test`.

> Note this is an **estimate** based on static call reachability, not executed-line coverage. Flag in the header/tooltip as "graph-estimated." Confirm the heuristic at review — an alternative simpler metric is binary (covered/uncovered) with % = 100/0 only, but that won't reproduce the 42%/88% look.

- **Frontend**: dedicated `TestCoverageView` rendering the header sentence + per-function rows (name, `X% · no tests` / `X% ✓`), colored by band. Row click → GitHub (§2). "Save to note" as in §6.

### Files touched
`app/db/neo4j.py` (new coverage query), `app/services/test_coverage_service.py`, `frontend/components/workspace/RightPanel.tsx`, `frontend/lib/api.ts` (response type).

---

## 8. Architecture tool — draw an architecture diagram + AI insights

### Current state
`stream_architecture_summary` ([architecture_service.py:64](app/services/architecture_service.py#L64)) already prompts the LLM to emit a `## Dependency Graph` Mermaid block, and the frontend `MarkdownRenderer` renders Mermaid (Phase 5). But: the diagram is **LLM-authored Mermaid** (fragile syntax, hallucinated edges) and there's no dedicated "insights" framing.

### Proposed change
Make the diagram **deterministic** and add an explicit **AI Insights** section:
1. **Deterministic Mermaid from the graph.** New helper `build_module_mermaid(graph)` that aggregates file→module edges from Neo4j import data into a `graph TD` at directory/module granularity (cap ~12 nodes, dedupe edges). This guarantees valid, accurate Mermaid instead of trusting the LLM to draw it.
2. **AI insights.** Keep the LLM for prose but re-scope the prompt to: `## Overview`, `## Module Responsibilities`, `## Key Design Patterns`, and a new `## Insights` (coupling hotspots, layering violations, suggested refactors, risky god-modules). Concatenate the deterministic Mermaid block into the streamed output so it always renders.
3. **Frontend**: architecture already flows through `MdContent`/`MarkdownRenderer` ([RightPanel.tsx:424](frontend/components/workspace/RightPanel.tsx#L424)) — no structural change needed once the backend emits a valid Mermaid fence. Optionally give the diagram its own styled container.

### Files touched
`app/services/architecture_service.py` (deterministic diagram builder + revised prompt), possibly `app/db/neo4j.py` (a module-edge query), `frontend/components/workspace/RightPanel.tsx` (styling only).

---

## Cross-cutting cleanup checklist
- Remove now-dead store fields/actions and fix all TS references (compile with `npm run build`).
- Remove `centerTab === 'explorer'` branches; `CenterTab` becomes `'chat'` only (or delete the tab bar).
- Prune unused api methods (`fileTree`, `fileContent`, `myRepos`, `repoStatus`, `sessions.*`).
- Backend router registrations to drop (optional): `files_router`, `sessions_router`.
- Keep `repo_files` write path (README source for onboarding) and the single-row `user_repos` (active-repo resolution).

## Suggested sequencing
1. §3 (onboarding heuristic) and §8 (architecture) — isolated backend edits, low blast radius.
2. §6 + §7 (dead code / coverage) — backend shape + new views, share "Save to note".
3. §2 (GitHub deep-links) — cross-cuts citations + flow tracer; add `commit_sha`/`rel_path` first.
4. §4 + §5 (remove repo history + chat sessions) — largest frontend deletion; do last so earlier UI work isn't invalidated.

## Open decisions to confirm before coding
1. **§4**: OK to keep a single backend `user_repos` row (required for tools) while removing the history/multi-repo UI? Or do you want the table dropped entirely (would require re-plumbing every tool to a session-scoped in-memory repo id)?
2. **§7**: Accept the graph-estimated coverage % heuristic (in-degree ranking + test-caller ratio), labeled "estimated"?
3. **§6/§7 "Save to note"**: append a markdown summary as an assistant message in the chat (recommended), or copy-to-clipboard?
