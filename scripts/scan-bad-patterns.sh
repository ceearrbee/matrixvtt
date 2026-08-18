#!/usr/bin/env bash
# scan-bad-patterns.sh - fail CI on a small set of always-bad patterns.
# Each pattern is paired with a rationale; if you intentionally want one
# of these, add an inline `// eslint-disable-next-line` style comment
# OR refactor (the right answer 99% of the time).
#
# Patterns deliberately scoped to what cheap grep can decide definitively;
# fuzzier patterns belong in the ESLint plugin.

set -u

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

fail=0

scan() {
  local label="$1"
  local pattern="$2"
  shift 2
  # Remaining args are extra grep options (e.g., --exclude=foo).
  local hits
  hits=$(grep -rEn "$pattern" src/ "$@" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    echo "❌ $label"
    echo "$hits" | sed 's/^/   /'
    echo
    fail=1
  fi
}

# JSON.parse(JSON.stringify(...)) - slow deep clone, almost never needed.
# structuredClone or a focused helper is the right answer. Tests that
# legitimately simulate file-writer serialization are excluded.
scan "Deep-clone via JSON round-trip" 'JSON\.parse\(JSON\.stringify\(' \
  --exclude-dir=__tests__

# Bare console.log left in src/ - use utils/logger.js. The logger modules
# themselves legitimately call console.log internally, so they're excluded.
scan "Bare console.log in src/" 'console\.log\(' \
  --exclude=logger.js --exclude=remoteLogger.js

# eval / new Function - use the AST evaluator at src/engine/evaluate.js
# instead. Lint catches some, this catches the rest.
scan "eval or new Function" '\beval\(|new Function\('

# input[type=url] on a field that holds image_url. Browsers refuse to
# submit forms whose <input type="url"> value isn't a fully-qualified
# URL - so our /matrixvtt/icons/<…>.svg paths from the built-in icon
# library trigger "please update the URL" on save. Use type="text"
# (or omit the type attribute) on any image_url input so URLs, mxc://
# URIs, and library paths are all accepted.
scan 'input[type="url"] on an image_url field (rejects library paths)' \
  '(id|name)[="]*"[a-zA-Z_-]*image[-_]?url"[^>]*type="url"|type="url"[^>]*(id|name)[="]*"[a-zA-Z_-]*image[-_]?url"'
scan 'JSX `type: "url"` on an image_url input (rejects library paths)' \
  "type:\\s*'url'.*image[-_]?url|image[-_]?url.*type:\\s*'url'"

# Account-global Matrix mutations. The app must never change anything
# visible outside the rooms it runs in: display name and avatar are
# room-scoped m.room.member writes (MatrixClient.setRoomDisplayName /
# room-adapter.setRoomDisplayName), and profile / account data /
# presence / pushers are off-limits entirely. The manager-level
# setDisplayName methods are room-scoped wrappers and stay allowed.
scan "Account-global Matrix API (use room-scoped member events)" \
  'sdk\.setDisplayName\(|widgetApi\.setDisplayName\(|widgetApi\)\.setDisplayName\(|\.(setAvatarUrl|setProfileInfo|setAccountData|setPresence|setPusher|setPassword|addThreePid|setIgnoredUsers)\('

# Em dash - house writing rule bans it everywhere in the repo. Third-party
# ruleset data quoting SRD text and generated docs (examples/, VitePress
# cache) are excluded.
emdash=$(
  grep -rn "$(printf '\xe2\x80\x94')" src/ --exclude-dir=rulesets 2>/dev/null
  grep -rn "$(printf '\xe2\x80\x94')" docs/ .github/ ./*.md --include='*.md' --exclude-dir=examples --exclude-dir=.vitepress --exclude-dir=skills 2>/dev/null
  true
)
if [ -n "$emdash" ]; then
  echo "❌ Em dash (house rule: never use em dashes)"
  echo "$emdash" | sed 's/^/   /'
  echo
  fail=1
fi

# Unawaited canEditRoomState(). The function is async; an unawaited
# call in a guard is a truthy Promise and passes for everyone.
# Definition files and tests are excluded; any other call site must
# carry an await on the same line.
unawaited=$(grep -rnE 'canEditRoomState(\?\.)?\(' src/ --include='*.js' --include='*.jsx' 2>/dev/null \
  | grep -vE '__tests__|ClientManager\.js|WidgetManager\.js|room-adapter\.js' \
  | grep -vE 'await ' \
  | grep -vE ':[0-9]+:\s*(//|\*|/\*)' || true)
if [ -n "$unawaited" ]; then
  echo "❌ canEditRoomState() without await (async guard always passes)"
  echo "$unawaited" | sed 's/^/   /'
  echo
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "✓ scan-bad-patterns: clean"
  exit 0
fi
echo "scan-bad-patterns: violations above - fix or refactor."
exit 1
