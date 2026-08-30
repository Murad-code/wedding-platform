#!/usr/bin/env bash
#
# Deployment smoke tests (docs/CLIENT_DEPLOYMENT.md §10).
#
#   ./scripts/smoke.sh https://sarahandadam.example.com
#
# Everything here is checkable without credentials, which is the point: it is what an
# anonymous stranger sees, and every one of these has a wrong answer that would be a
# security incident. The credentialled checks in §10 — logging in, RSVPing, uploading
# media — stay manual because they write data to a real wedding.
set -uo pipefail

BASE="${1:?usage: smoke.sh <base-url>}"
BASE="${BASE%/}"
FAILURES=0

pass() { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1" >&2; FAILURES=$((FAILURES + 1)); }

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
headers() { curl -s -D - -o /dev/null "$@"; }

# A 43-character token-shaped string that is not a real token.
FAKE_TOKEN="$(printf 'a%.0s' $(seq 43))"

echo "Smoke testing ${BASE}"

# --- reachability -----------------------------------------------------------
if curl -sf "${BASE}/api/health" | grep -q '"status":"healthy"'; then
  pass 'health reports the app and database are up'
else
  fail 'health check did not report healthy'
fi

# --- transport --------------------------------------------------------------
case "$BASE" in
  https://*)
    REDIRECT="$(status -o /dev/null "http://${BASE#https://}")"
    if [ "$REDIRECT" = "301" ] || [ "$REDIRECT" = "308" ]; then
      pass 'HTTP redirects to HTTPS'
    else
      fail "HTTP did not redirect (got ${REDIRECT})"
    fi

    if headers "$BASE/" | grep -qi 'strict-transport-security'; then
      pass 'HSTS is set'
    else
      fail 'HSTS is missing'
    fi
    ;;
  *)
    echo '  skip  TLS checks (not an https URL)'
    ;;
esac

# --- security headers -------------------------------------------------------
SITE_HEADERS="$(headers "$BASE/")"
for header in 'x-content-type-options' 'x-frame-options' 'referrer-policy' 'content-security-policy'; do
  if echo "$SITE_HEADERS" | grep -qi "^${header}:"; then
    pass "${header} present"
  else
    fail "${header} missing"
  fi
done

TOKEN_HEADERS="$(headers "${BASE}/invite/${FAKE_TOKEN}")"
if echo "$TOKEN_HEADERS" | grep -qi '^referrer-policy: no-referrer'; then
  pass 'invitation URLs send no referrer'
else
  fail 'invitation URLs would leak the token in a referrer'
fi
if echo "$TOKEN_HEADERS" | grep -qi '^x-robots-tag:.*noindex'; then
  pass 'invitation URLs are not indexable'
else
  fail 'invitation URLs are indexable'
fi

# --- authorisation ----------------------------------------------------------
DASH="$(status -o /dev/null "${BASE}/dashboard")"
if [ "$DASH" -ge 300 ] && [ "$DASH" -lt 400 ]; then
  pass 'the dashboard refuses an anonymous visitor'
else
  fail "the dashboard returned ${DASH} to an anonymous visitor"
fi

# Nothing that lists guests may answer an anonymous request (docs/SECURITY.md §3).
for endpoint in '/api/invitation-parties' '/api/guests' '/api/notifications' '/api/photo-groups' '/api/tables'; do
  CODE="$(status "${BASE}${endpoint}")"
  if [ "$CODE" -ge 400 ]; then
    pass "${endpoint} is closed (${CODE})"
  else
    fail "${endpoint} answered anonymously with ${CODE}"
  fi
done

EXPORT="$(status -o /dev/null "${BASE}/api/guests/export")"
if [ "$EXPORT" != "200" ]; then
  pass "the guest export is not downloadable anonymously (${EXPORT})"
else
  fail 'the guest export downloaded anonymously'
fi

# --- tokens -----------------------------------------------------------------
for path in "/invite/${FAKE_TOKEN}" "/photos/${FAKE_TOKEN}" '/invite/short'; do
  CODE="$(status "${BASE}${path}")"
  if [ "$CODE" = "404" ]; then
    pass "a wrong token is refused at ${path%/*}/… (404)"
  else
    fail "${path} returned ${CODE} for a token that does not exist"
  fi
done

echo
if [ "$FAILURES" -eq 0 ]; then
  echo 'All smoke tests passed.'
else
  echo "${FAILURES} smoke test(s) failed." >&2
fi
exit "$FAILURES"
