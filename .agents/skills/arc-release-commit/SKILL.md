---
name: arc-release-commit
description: Apply Arc for Chrome's commit and release policy when asked to commit, bump a version, tag, or prepare a release. Use for every requested repository commit, including «закоммить».
---

# Arc for Chrome commits and releases

1. Inspect HEAD, the worktree, the index and local tags. Commit only the requested files and omit AI attribution. Keep unrelated staged and untracked changes outside the commit.
2. For ordinary commits, including small fixes, copy changes, refactors and CI maintenance, leave versions and tags alone. Update both READMEs if instructions or user-facing behavior changed.
3. Prepare a release when expressly requested or when a requested commit completes a significant feature, breaking change, or critical fix. A series of small changes can ship together as an intentional release. If significance is unclear, make an ordinary commit. Use the requested version, or choose an unused SemVer version appropriate to the changes. Synchronize `package.json` and `extension/manifest.json`, and update the current version and relevant usage notes in both READMEs.
4. Check the scoped diff and, for a release, verify the matching version fields. Commit the intended paths and create the local tag `vX.Y.Z` on the release commit only. Verify the tag target.
5. Push only when requested. Pushing a version tag to GitHub triggers the release workflow, which checks the extension, packages the ZIP and publishes a release with generated notes.
