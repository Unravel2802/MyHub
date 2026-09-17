---
title: Abuse, fraud, and bot defence
minutes: 18
summary: Defending without punishing real users — the constraint that makes this category genuinely harder than a clean allow/block decision.
---

Most security decisions in this track are binary: a request is either
authorized or it isn't, a signature either verifies or it doesn't. Abuse
defense is different — nearly every signal (a fast request rate, an
automated-looking pattern, a new account) is ambiguous, produced by both
genuine users AND attackers, which means every defense here is a
probabilistic trade-off, not a clean rule.

## Account takeover: credential stuffing at scale

```text
  an attacker has a LEAKED list of (email, password) pairs from
  some COMPLETELY UNRELATED breach — and tries EVERY pair
  against YOUR login endpoint, betting that a meaningful
  fraction of users reused the same password across sites.

  → RATE LIMITING login attempts (the Rate Limiting and
    Resilience chapter's machinery, applied specifically to an
    auth endpoint) slows this down, but doesn't stop it entirely
    — a DISTRIBUTED attack spreads attempts across many source
    IPs specifically to evade a naive per-IP rate limit. the
    more effective defense: detecting the PATTERN (many
    DIFFERENT accounts, one CREDENTIAL PAIR each, tried in
    rapid succession, from IPs with no prior relationship to
    the account) rather than relying on volume from a single
    source alone.
```

```text
  → this is exactly why MFA (the Identity chapter) matters SO
    much specifically as a defense here: even a CORRECT,
    leaked password is USELESS to an attacker without the
    second factor — MFA doesn't just make an individual
    account harder to compromise, it makes an ENTIRE credential-
    stuffing attack strategy far less profitable at scale, since
    the attacker's leaked password list becomes mostly useless
    against MFA-protected accounts.
```

## Scraping: the ambiguous case

```text
  a bot systematically reading every page on your site —

  → is this: a LEGITIMATE search engine indexing your content
    (which you generally WANT, for organic discoverability), a
    COMPETITOR copying your entire product catalog, or a
    researcher's harmless one-off script? the RAW SIGNAL (an
    automated client making many sequential requests) looks
    nearly identical across all three, and the RIGHT response
    genuinely differs by which one it actually is.
```

```text
  → practical, imperfect signals used together: request RATE
    (unusually fast, beyond plausible human browsing speed),
    PATTERN (sequential, exhaustive access to every single page
    in order — a shape real human browsing essentially never
    produces), and a robots.txt-declared policy (which a well-
    behaved bot respects VOLUNTARILY, and a determined
    adversarial one simply ignores entirely, which is precisely
    why it's a POLICY declaration and not an actual technical
    enforcement mechanism).
```

## CAPTCHAs: a real, imperfect human/bot boundary

```text
  → a CAPTCHA's actual value isn't being unbreakable (determined
    attackers increasingly use CAPTCHA-solving services, human
    click-farms, or ML-based solvers) — it's adding enough
    COST (time, money, friction) that LOW-VALUE, high-volume
    automated abuse becomes economically unprofitable, while a
    genuinely determined, well-funded attacker targeting
    something specifically high-value can still eventually get
    through it.

  → the real design trade-off: a CAPTCHA on EVERY login adds
    friction for EVERY legitimate user, EVERY time, which is a
    real, measurable cost paid by 100% of real traffic — a
    RISK-BASED approach (showing a CAPTCHA only when OTHER
    signals already suggest elevated risk: a new device, an
    unusual location, a suspicious request pattern) concentrates
    the friction where it's actually likely to matter, rather
    than taxing every single legitimate login for a threat that
    applies to only a small fraction of them.
```

## Fraud signals: combining weak signals into a real decision

```text
  NO SINGLE signal reliably distinguishes fraud from legitimate
  activity on its own — a new account, an unusual purchase
  amount, a mismatched billing/shipping address, an unusual
  time of day, are all individually WEAK, ambiguous, and
  produced constantly by entirely legitimate users too.

  → a FRAUD SCORING system COMBINES many weak signals into ONE
    aggregate risk score, and takes graduated ACTION based on
    where that score lands (allow outright / require additional
    verification / hold for manual review / block outright) —
    this is genuinely probabilistic reasoning applied to a
    real-time decision, not a deterministic allow/deny rule the
    way most of the rest of this track's decisions have been.
```

## The core tension: false positives have a real cost too

```text
  → every abuse-defense mechanism in this chapter has a REAL
    false-positive rate — a legitimate user blocked, delayed,
    or forced through extra friction by a system that
    (incorrectly) flagged them as suspicious. this is a REAL,
    OPPOSING cost to under-blocking, not a purely theoretical
    concern: an overly aggressive fraud system that blocks 5% of
    LEGITIMATE transactions to catch 1% of fraudulent ones may
    be a genuinely WORSE trade for the business than a looser
    system that lets slightly more fraud through in exchange for
    far fewer false positives against real, paying customers.
```

```text
  → this is exactly the "security as an explicit trade-off, not
    an absolute" point from the Security Foundations chapter,
    concretely instantiated: the RIGHT threshold for how
    aggressive a defense should be depends on the actual,
    measured cost ratio between a missed attack and a
    frustrated legitimate user — not on maximizing detection
    rate in isolation, which optimizes for catching fraud while
    ignoring the real, measurable cost paid by every falsely-
    flagged genuine user.
```

## What to take away

1. Nearly every abuse signal is ambiguous, produced by both genuine users
   and attackers — abuse defense is a probabilistic trade-off, not a clean
   allow/block rule the way most other security decisions are.
2. Distributed credential stuffing evades naive per-IP rate limiting — the
   more effective signal is the pattern (many accounts, one credential pair
   each) rather than volume from a single source.
3. MFA's value against credential stuffing specifically is that it makes an
   entire leaked-password-list attack strategy unprofitable at scale, not
   just harder to compromise one account.
4. A CAPTCHA's real value is adding enough cost to make low-value automated
   abuse unprofitable, not being unbreakable — a risk-based approach
   concentrates the friction cost where elevated risk actually exists
   rather than taxing every legitimate user.
5. False positives have a real, measurable cost too — the right defense
   aggressiveness depends on the actual cost ratio between a missed attack
   and a frustrated legitimate user, not on maximizing detection rate in
   isolation.
