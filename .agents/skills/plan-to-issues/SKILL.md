---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Every issue carries the shape in [What every issue carries](#what-every-issue-carries).
   Ask the human only if this plan needs something more (extra fields, labels, wording).
5. Create the plan's label if it is missing, then each issue in dependency order, so
   blocked-by can cite real numbers:

   ```sh
   gh label create "plan:<plan>" --description "Issues split from plan.md: <plan>"
   gh issue create --title "<title>" --label "plan:<plan>" --body-file <tmp.md>
   ```

   A forward reference (an issue citing one not created yet) gets fixed with
   `gh issue edit <n> --body-file` once that number exists.
6. Record every issue URL from gh's output (not from memory) and reply with the list.

## What every issue carries

Approved by the human on 2026-11-12 (plan: morning-digest).

- **Label:** `plan:<plan>`, the `plan:` value from `plan.md`'s frontmatter (e.g.
  `plan:morning-digest`). That's how the reviewer sorts them.
- **First line, exactly:** `Source: plan.md § <n>` (`<n>` as the plan numbers it: `1`, `2a`, …).
  One section may give more than one issue; each cites the same section.
- **Body sections, in this order:**

  ```md
  Source: plan.md § <n>

  ## Scope
  <the plan's text for that section, plus where the code goes>

  ## Done when
  <the plan's "Done when", word for word>

  ## Blocked by
  <#n, or —; say when an issue can start on one issue but can only close on another>

  ## Suggested worker
  <strongest model (logic) or cheaper model (views, tests)>
  ```

### Steps that wait on someone else

A step that ends in someone else's look (a reviewer, a client) is done only once they have
looked, not once you have sent it. Its issue stays open, with a comment saying what it waits
on, and anything after it (clean-up) is blocked by it.

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
