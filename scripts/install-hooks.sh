#!/usr/bin/env bash
# Enable this repo's tracked git hooks. Run once per clone.
# (core.hooksPath lives in .git/config, which does not travel with a clone.)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
echo "✓ hooks enabled: core.hooksPath -> .githooks (pre-commit runs scripts/verify.sh)"
