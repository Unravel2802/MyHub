---
title: "Identity: OAuth, OIDC, and sessions"
minutes: 18
summary: JWT pitfalls, session fixation, and MFA — the specific, recurring mistakes in identity systems that the AuthN/AuthZ chapter's mechanisms enable if used carelessly.
---

The AuthN and AuthZ chapter covered sessions, JWTs, OAuth, and RBAC as
mechanisms. This chapter is the specific, recurring ways those exact
mechanisms go wrong in practice — because each one has a well-known failure
mode that keeps reappearing across unrelated systems, precisely because it's
subtle enough to miss without knowing to look for it.

## JWT pitfalls beyond "the payload is readable"

```text
  the `alg: none` attack:

    { "alg": "none", "typ": "JWT" }
    { "sub": "admin", "role": "admin" }

  → some JWT LIBRARIES historically accepted a token that
    claims `alg: none` (no signature at all) as VALID — an
    attacker simply constructs a token claiming to be an admin,
    with NO signature, and a vulnerable verification path
    accepts it because it never actually checked that a
    signature algorithm was REQUIRED.
```

```text
  → the fix: the VERIFIER must specify EXACTLY which algorithm
    it expects and REJECT anything else — never trust the
    algorithm a TOKEN claims to use (the `alg` header is
    attacker-controlled, part of the unsigned/readable payload)
    to decide how to verify it. this is the same "never trust
    client-supplied data" discipline the AuthN/AuthZ chapter
    ends on, applied to a field INSIDE the token itself, which
    is easy to overlook precisely because it feels like part
    of the trusted token rather than untrusted input.
```

```text
  → a SECOND recurring JWT mistake: no REVOCATION path for a
    token that's STILL within its expiry window but should no
    longer be valid (a user's access was just revoked, a
    password just changed) — this is the AuthN/AuthZ chapter's
    session-vs-JWT trade-off in practice: a short expiry plus a
    refresh-token flow bounds the damage window, but doesn't
    eliminate it entirely; a genuinely urgent revocation needs
    an explicit denylist, accepting the lookup cost that
    defeats part of JWT's original no-lookup appeal.
```

## Session fixation

```text
  1. attacker visits the site, gets session id "ABC123"
     (BEFORE logging in)
  2. attacker tricks a VICTIM into using THAT SAME session id
     (a crafted link, a cookie set via a vulnerable subdomain)
  3. victim LOGS IN — using the session id "ABC123" the
     attacker already knows
  4. attacker, who already had "ABC123", is now ALSO logged in
     as the victim
```

```text
  → the fix: ALWAYS issue a BRAND NEW session id at the moment
    of successful login — NEVER reuse whatever session id
    existed before authentication happened. this single rule
    closes the entire attack: even if an attacker successfully
    planted a KNOWN session id beforehand, it becomes worthless
    the instant login rotates it to something the attacker
    never saw.
```

## OAuth's redirect URI: the parameter that must be validated exactly

```text
  the authorization flow (the AuthN/AuthZ chapter's diagram)
  redirects back to a `redirect_uri` the CLIENT specifies —

    redirect_uri=https://myapp.com/callback           ✓
                    registered, exact match
    redirect_uri=https://myapp.com.evil.com/callback   ✗ if
                    validation is loose (e.g., "starts with
                    myapp.com"), an ATTACKER-CONTROLLED domain
                    passes the check
```

```text
  → the authorization SERVER must validate `redirect_uri`
    against an EXACT, pre-registered allowlist — not a prefix
    match, not a pattern match — because a loosely-validated
    redirect sends the authorization CODE (which is exchangeable
    for an access token) to WHATEVER URL passed the check,
    which an attacker can set up to be their own server if the
    validation has any exploitable looseness.
```

## Refresh tokens and rotation

```text
  → a LEAKED refresh token (logged accidentally, exposed in a
    misconfigured client) is a LONG-LIVED credential — unlike
    a short-lived access token, it doesn't expire quickly on
    its own, which makes it a genuinely more damaging leak.

  → REFRESH TOKEN ROTATION: each time a refresh token is used
    to get a new access token, it's INVALIDATED and REPLACED
    with a NEW refresh token — this bounds a leaked-but-unused
    token's value AND, critically, provides a detection signal:
    if BOTH the legitimate client and an attacker try to use
    the SAME (now-rotated, now-invalid) old refresh token, the
    mismatch itself is a strong signal that a token was
    compromised and can trigger revoking the entire token
    family.
```

## Multi-factor authentication: layers, and where each one is weak

```text
  SOMETHING YOU KNOW    a password — vulnerable to phishing,
                        reuse across sites, guessing
  SOMETHING YOU HAVE      a phone (SMS/TOTP), a hardware key
                        — vulnerable to SIM-swapping (for SMS
                        specifically) or device theft
  SOMETHING YOU ARE        biometrics — vulnerable to spoofing,
                        and CANNOT be rotated if compromised
                        (you can't issue yourself a new
                        fingerprint)
```

```text
  → MFA's real value is requiring an attacker to compromise
    MULTIPLE, INDEPENDENT factors simultaneously — this is the
    Security Foundations chapter's defense-in-depth applied to
    authentication specifically. SMS-based MFA is WEAKER than
    an authenticator app or hardware key (SIM-swapping is a
    real, practiced attack that bypasses the "something you
    have" factor without needing the physical phone at all) —
    "we have MFA" isn't a single fact; WHICH factor matters.
```

## What to take away

1. A JWT verifier must specify and enforce exactly which algorithm it
   expects, never trusting the token's own `alg` header — the classic
   `alg: none` bypass exploits verifiers that skip this check.
2. JWTs have no built-in revocation path within their expiry window — a
   short expiry plus refresh tokens bounds the damage but doesn't eliminate
   it; urgent revocation needs an explicit denylist.
3. Session fixation is closed by one rule: always issue a brand-new session
   id at successful login, never reuse whatever id existed beforehand.
4. An OAuth authorization server must validate `redirect_uri` against an
   exact, pre-registered allowlist — a loose prefix or pattern match lets an
   attacker redirect the authorization code to their own server.
5. Refresh token rotation invalidates and replaces the token on each use,
   which both bounds a leaked token's value and gives a detection signal
   when both a legitimate client and an attacker try to use the same
   now-stale token.
