---
name: zepp-release
description: Cut a release of this app end to end - merge the work, drive the release-please pull request to green, and check the .zab that comes out. Use when asked to release, ship a version, or publish a new build.
---

# Cutting a release

Releases are automated with release-please. Merging to `main` maintains a release
pull request that bumps `package.json` and the changelog; merging **that** tags a
GitHub Release, and `build-and-distribute.yml` builds the `.zab` and attaches it.
Uploading to the Zepp App Store stays manual - Zepp has no publish API.

## The order

1. **Land the work.** Merges into `main` are rebase-only and one approving review
   is required. You cannot approve your own pull request, so your own work needs
   `gh pr merge <n> --rebase --admin`. Ask before using the override.

2. **Wait for the release pull request.** Release Please runs on push to `main`.

3. **Approve its workflow runs.** They are bot-authored, so they sit in
   `action_required` and report no checks at all until approved:

   ```bash
   gh run list --repo <owner>/<repo> --branch release-please--branches--main--components--<pkg> --limit 5 \
     --json status,conclusion,name,databaseId
   gh api -X POST repos/<owner>/<repo>/actions/runs/<id>/approve
   ```

4. **Drive it green.** If a check fails on the release pull request but passes on
   `main`, suspect a stale branch - see below.

5. **Merge it.** The bot is the author, so you can approve this one normally:
   `gh pr review <n> --approve` then `gh pr merge <n> --rebase`.

6. **Check what shipped.**

   ```bash
   gh release view <tag> --repo <owner>/<repo> --json tagName,isDraft,assets
   ```

   The asset name carries the version, and `build-zab / build-zab` must have
   succeeded in the Release Please run.

## The stale release branch

The release branch is sticky: once the pull request exists, release-please does
**not** rebase it when `main` moves. So a fix landed on `main` afterwards is
missing from the release branch, and its checks stay red on code that is already
fixed. Re-running the workflow does not help.

The remedy is to delete the release branch and re-run Release Please, which
rebuilds it from current `main`:

```bash
gh api -X DELETE repos/<owner>/<repo>/git/refs/heads/release-please--branches--main--components--<pkg>
gh run rerun <last Release Please run id> --repo <owner>/<repo>
```

The pull request number changes. Deleting a branch is a destructive remote action:
ask first, even though this one is bot-generated and rebuilt automatically.

## Versions

`app.json` is not the source of truth. The build workflow derives `version.name`
from `package.json` and `version.code` as `major*10000 + minor*100 + patch`, an
ever-increasing integer the store requires. Do not hand-edit `app.json` versions
to match; a CI check compares the two files.
