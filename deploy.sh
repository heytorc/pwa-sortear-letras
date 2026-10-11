#!/usr/bin/env bash
set -euo pipefail

if [ ! -d .git ]; then
  echo "Error: not a git repo. Run: git init && git remote add origin <url>"
  exit 1
fi

REMOTE=$(git remote get-url origin)

echo "Deploying to gh-pages branch..."

# Clean up any leftover worktree
git worktree remove /tmp/gh-pages-deploy --force 2>/dev/null || true

# Create worktree on gh-pages (or orphan if first deploy)
if git ls-remote --exit-code --heads origin gh-pages &>/dev/null; then
  git fetch origin gh-pages
  git worktree add /tmp/gh-pages-deploy origin/gh-pages
else
  git worktree add --orphan -b gh-pages /tmp/gh-pages-deploy
fi

# Sync files (exclude git internals and the deploy script itself)
rsync -a --delete \
  --exclude='.git' \
  --exclude='deploy.sh' \
  . /tmp/gh-pages-deploy/

cd /tmp/gh-pages-deploy
git add -A
if git diff --cached --quiet; then
  echo "Nothing to deploy."
  cd - >/dev/null
  git worktree remove /tmp/gh-pages-deploy --force
  exit 0
fi
git commit -m "Deploy $(date '+%Y-%m-%d %H:%M:%S')"
git push origin HEAD:gh-pages

cd -
git worktree remove /tmp/gh-pages-deploy --force

# Parse GitHub Pages URL from remote
REPO_PATH=$(echo "$REMOTE" \
  | sed 's|git@github.com:||' \
  | sed 's|https://github.com/||' \
  | sed 's|\.git$||')
USER=$(echo "$REPO_PATH" | cut -d'/' -f1)
REPO=$(echo "$REPO_PATH" | cut -d'/' -f2)
echo ""
echo "✓ Deployed! Available at: https://${USER}.github.io/${REPO}/"
echo "  (Enable GitHub Pages on the gh-pages branch in repo Settings → Pages)"
