#!/usr/bin/env sh
set -eu

GITHUB_URL="https://github.com/Loxime/yellow-jacket.git"
GITLAB_URL="https://gitlab.rusanor.fr/inquest/inquest-dev/yellow-jacket.git"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$GITHUB_URL"
else
  git remote add origin "$GITHUB_URL"
fi

git remote remove gitlab >/dev/null 2>&1 || true
git remote add gitlab "$GITLAB_URL"
git config remote.gitlab.skipDefaultUpdate true

printf '%s\n' "Configured remotes:" 
git remote -v
printf '%s\n' "" "Policy:" "  origin  = GitHub fetch + push" "  gitlab  = GitLab push-only by project convention" "" "Push both with:" "  git push origin main && git push gitlab main"
