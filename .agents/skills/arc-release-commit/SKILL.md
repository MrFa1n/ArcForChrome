---
name: arc-release-commit
description: Prepare a versioned Arc for Chrome commit with matching English and Russian READMEs and a local Git tag. Use for every requested commit in this repository, including «закоммить», «коммить», «тегни», and version bumps.
---

# Arc for Chrome release commit

1. Inspect the worktree, index, HEAD and local tags. Determine which files belong to the requested change. If the feature is already committed and still untagged, prepare a follow-up release commit. Keep unrelated staged and untracked files outside the commit.
2. Use the requested version if provided. Otherwise increment the patch of the current release and choose a version whose `vX.Y.Z` tag is unused. Set the same version in `package.json` and `extension/manifest.json`.
3. Update `README.md` and `README.ru.md` together. Describe the actual user-facing changes and how to use them. If the change has no user-facing effect, update the current version reference in both files. Format the touched Markdown and JSON with Prettier.
4. Check the release diff for whitespace errors and verify that both version fields match. Commit only the release paths. Respect any explicit exclusions and omit AI attribution from commit messages.
5. Create the local tag `vX.Y.Z` on the new commit. Verify the tag points at that commit and report the version, tag and short hash. Push only when requested.
