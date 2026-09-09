#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" — decides whether a deployment needs a build at all.
#
# EXIT CODES ARE INVERTED FROM INTUITION, and Vercel defines them, not us:
#
#   exit 0  ->  SKIP the build   (deployment is canceled, production keeps serving
#                                 the previous build)
#   exit 1  ->  RUN the build
#
# Getting this backwards stops production deploying, so the only safe default is
# exit 1. Every path below that cannot be proven irrelevant to `next build` must
# fall through to a build: a wasted build costs a few cents of build CPU, while a
# wrong skip leaves production silently behind main with no failure anywhere.
#
# Why this exists: this repo holds the Next.js app plus three things that deploy
# somewhere else entirely — the Expo partner app, an AWS Lambda, and an ESP32
# worker. Before this, a commit touching only those still paid for a full
# Next.js production build. Build CPU was 88% of one month's on-demand bill.
#
# Usage: bash scripts/vercel-ignore-build.sh [commit]
#   Defaults to HEAD. Pass a commit to check what the decision would have been
#   for an earlier merge, which is how the pathspec list below gets tested.

set -u

COMMIT="${1:-HEAD}"

# Paths that cannot reach the Next.js bundle.
#
# Deliberately NOT listed, because they are build inputs despite appearances:
#   remotion/  — src/lib/remotion-render.ts imports ../../remotion/OfferVideo
#   scripts/   — not called by `npm run build` today, but cheap to keep honest
#   prisma/    — `prisma migrate deploy && prisma generate` run every build
#   public/, shared/, src/, and every root config file
IGNORED_PATHS=(
  ':(exclude)store-app'        # Expo app -> EAS Build / Play Store, own lockfile
  ':(exclude)transcode-lambda' # AWS Lambda -> .github/workflows/transcode-lambda-deploy.yml
  ':(exclude)footfall-worker'  # ESP32 firmware + worker, own package.json
  ':(exclude)docs'             # markdown only
  ':(exclude).github'          # CI config
  ':(exclude)graphify-out'     # generated knowledge graph
  ':(exclude)*.md'             # CLAUDE.md, README.md, ALIVE_PLAYER_API.md, ...
)

# No parent commit means there is nothing to compare against — build.
# This also covers Vercel's shallow clone not having HEAD^ available.
if ! git rev-parse --verify --quiet "${COMMIT}^" >/dev/null 2>&1; then
  echo "vercel-ignore-build: no parent for ${COMMIT}, building."
  exit 1
fi

# For a merge commit this diffs against the first parent, so a squashed or
# merged PR is judged on its whole net effect rather than its last commit.
if git diff --quiet "${COMMIT}^" "${COMMIT}" -- . "${IGNORED_PATHS[@]}"; then
  echo "vercel-ignore-build: only non-app paths changed, skipping build."
  exit 0
fi

echo "vercel-ignore-build: app files changed, building."
exit 1
