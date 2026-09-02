---
name: review-cycle
description: Run a review pass over a pull request in this repository and land each valid finding as its own commit, keeping the pipeline green. Use when asked to review a PR, do review cycles, or self-review work before merging.
---

# Review cycle

A cycle is: read the diff looking for defects, verify each suspicion, then land
every valid finding as **its own commit** with a test that would have caught it.
Findings that turn out to be wrong are dropped, not written up.

## What to look for first

Order by what has actually bitten this project:

1. **Things only a device shows.** Draw order, opacity, whether a primitive works
   at all. The unit tests cannot see these, so reason about them explicitly and say
   what remains unverified.
2. **Invariants held by call-site discipline rather than by code.** "This works
   because the only caller happens to clear it first" is a finding: make the
   function hold its own invariant.
3. **State read back off a widget.** A real Zepp widget handle exposes nothing;
   the test double does. Anything read back must live in `state`.
4. **Geometry that overlaps something drawn.** A control box that reaches the board
   frame gets wiped along with its own background.
5. **Reuse-versus-rebuild inconsistencies.** If one part of a screen is recreated
   and another is moved, they end up on opposite sides of a canvas.

## Verifying a suspicion before writing it up

Prefer running the numbers to reading harder. A short `node --input-type=module`
script that imports the pure module and prints the geometry settles most layout
questions in one command, and gives the exact figures for the commit message.

## Landing a finding

Each finding gets one commit:

```
fix: <what is now true>            # single-line, Conventional Commits
```

with the regression test in the same commit. Then push and let CI run; do not
batch several findings into one commit, and do not fix a finding without a test
unless it genuinely cannot be reached from a test.

## Finishing a cycle

Report, per finding: what it was, why it mattered, how it was fixed. If a cycle
found nothing, say so plainly rather than inventing something to justify the pass.

Watch the pipeline to green before declaring the cycle done:

```bash
gh pr checks <n> --repo <owner>/<repo> --watch --interval 15
```

An `osv-scanner` line reading `skipping` is the SARIF upload step, not a failure;
the scan itself is the `osv-scan / osv-scan` line.
