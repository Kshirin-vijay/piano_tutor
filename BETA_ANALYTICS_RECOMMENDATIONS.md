# Beta analytics & auth — recommendations (draft)

Working notes for adding login, activity logging, and performance visibility before
beta testing on Vercel. Review this document, then create a final implementation plan
(`BETA_ANALYTICS_PLAN.md` or similar) with chosen options and concrete tasks.

---

## Goals

- Deploy the app on **Vercel** for beta testers.
- Know **who** is using the app (parent/guardian accounts).
- See **what each learner is doing** (levels started, mistakes, completions, etc.).
- Monitor **app performance** (load time, errors, optional custom timings).
- Keep **session replay on** for now, with an easy way to turn it off and redeploy.
- Minimize changes to the existing architecture (Vite + React SPA, local progress today).

---

## Current codebase (relevant seams)

| Module | Role today | Future use |
|--------|------------|------------|
| `src/progress/identity.ts` | Returns `"local"` as user id | Return authenticated **parent** user id |
| `src/config/events.ts` | Typed gameplay event bus (`AppEvent`) | Forward events to PostHog |
| `src/progress/recorder.ts` | Subscribes to `onEvent`, saves to localStorage | Keep local history; add remote capture |
| `src/config/agentApi.ts` | Facade for config + events + progress | Agent/analytics can use same surface |
| `src/components/Settings.tsx` | Caregiver UI (“For grown-ups”) | Stop replay here; consent / beta controls |

Progress and settings are **device-local** today. PostHog will only store what the app
explicitly sends. Local practice history is not visible to you unless events are captured.

---

## Vercel: what it provides vs what you add

| Need | Vercel default? | Notes |
|------|-----------------|-------|
| Hosting (Vite static build) | Yes (free Hobby tier) | Good fit for current app |
| Per-user login | **No** | Add Clerk, Supabase Auth, Auth0, etc. |
| Custom activity logs | **No** | PostHog (recommended) or Supabase table |
| Web performance (Core Web Vitals) | Partial | Vercel Analytics — paid add-on on Pro (~$20/mo); optional |
| Server/function logs | Only if you add API routes | Not needed for PostHog-only approach |
| Password-protect whole site | Deployment Protection (Pro+) | One shared password; **not** per-user tracking |

**Conclusion:** Vercel hosts the app. **Login + logs + replay** come from PostHog (+ auth provider).

---

## Recommended stack for beta

```
Vercel          → host static Vite build
Auth provider   → parent accounts only (Clerk or Supabase Auth — decide in final plan)
PostHog         → events, dashboards, session replay, basic performance
Sentry          → optional; free tier for crashes (can add later)
```

### Why PostHog (vs rolling your own DB)

- One SDK: events, funnels, replay, error tracking (optional).
- Generous free tier (~1M events/month).
- Fits existing `AppEvent` types with minimal mapping (`posthog.capture(event.type, event)`).
- No backend required for a static SPA (events sent from browser).

### Alternatives (if final plan differs)

| Approach | Pros | Cons |
|----------|------|------|
| **PostHog only** | Fastest dashboards | Auth still separate |
| **Supabase Auth + Postgres** | Own the event schema | More setup than PostHog |
| **Clerk + PostHog** | Polished login UX + analytics | Two services |
| **Migrate to Next.js** | API routes on Vercel | Unnecessary for beta |

---

## How PostHog stores logs

When the app calls `posthog.capture(...)`:

```
Browser (posthog-js)
    → PostHog ingest API
    → Kafka (buffer)
    → ClickHouse (main event store)
```

Each stored row includes:

| Field | Meaning |
|-------|---------|
| `event` | Event name, e.g. `level.completed` |
| `properties` | JSON payload (level number, mistake details, etc.) |
| `distinct_id` | User id (anonymous until `posthog.identify()`) |
| `timestamp` | When it happened |
| `uuid` | Unique event id |

**Person metadata** (email, role after login) lives in PostgreSQL and is synced for queries.

**Viewing data:** PostHog dashboard (Activity, Insights, HogQL, Dashboards). You do not
manage a database yourself.

**Retention (PostHog Cloud, as of 2026):**

| Plan | Event retention |
|------|-----------------|
| Free | **1 year** |
| Paid | Up to **7 years** (plan-dependent) |

**Session replay** is stored separately; replay retention is typically **~30 days**
(check current PostHog docs when implementing).

**Export (optional):** batch exports to S3, BigQuery, Postgres; CSV from insights; Query API.

**What PostHog does not store automatically:**

- Full practice history in `progressStore` / localStorage (unless you capture those events).
- Settings changes (unless you log them).
- Audio/piano internal state.

---

## Account model: parent vs child

### Recommendation: only parents have accounts

Children are **learner profiles** under a parent — not separate logins.

```
Parent account (login: email / magic link)
    └── Learner profile(s) (no login — nickname or "Learner 1")
            └── Practice sessions, events, session replay
```

| Role | Has login? | PostHog identity | Session replay |
|------|------------|------------------|----------------|
| **Parent** | Yes | `distinct_id` = parent user id | Usually **off** (settings, onboarding) |
| **Child / learner** | No | Same parent id + `learner_id` on events | **On** during practice (for now) |

### Do not rely on a self-declared “I am a parent” checkbox

Auth defines the parent account. Anyone can click a checkbox; login cannot be faked the same way.

### Do not create child logins for beta

Extra consent/complexity; session replay of minors needs careful handling and policy review.

---

## Classifying parent vs learner in PostHog

Use **person properties** (authenticated parent) and **event properties** (active learner).

**On parent login:**

```ts
posthog.identify(parentUserId, {
  account_role: "parent",
  beta_cohort: "2026-07",
  // email ok on parent record; avoid child PII on person properties
});
```

**When practice starts (learner selected):**

```ts
posthog.register({
  active_learner_id: learnerId,        // opaque id, e.g. "learner_abc123"
  active_learner_label: "Learner 1",  // optional nickname only — no real names
});

posthog.capture("practice.session_started", {
  learner_id: learnerId,
  account_role: "parent",
  session_subject: "learner",
});
```

**Forward existing gameplay events** from `onEvent()` with the same `learner_id` attached.

**Dashboard filters:**

- Events: `session_subject = learner`
- Replays: filter on `active_learner_id` or `session_subject = learner`
- Exclude caregiver screens: stop replay in Settings or tag `session_subject = parent`

### Optional: PostHog Groups (multi-child households)

```ts
posthog.group("household", householdId);
posthog.group("learner", learnerId, { label: "Learner 1" });
```

Useful for “all learners in this family” views. The logged-in person is still only the parent.

---

## Session replay: on for now, easy off via Vercel

### Deploy-time toggle (recommended)

Use a Vite env var so caregivers cannot accidentally disable replay from Settings.

```ts
posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: "https://us.i.posthog.com", // or EU host
  session_recording: {
    enabled: import.meta.env.VITE_SESSION_REPLAY === "true",
  },
});
```

**Vercel → Project → Settings → Environment Variables:**

| Variable | Example |
|----------|---------|
| `VITE_POSTHOG_KEY` | PostHog project API key |
| `VITE_POSTHOG_HOST` | `https://us.i.posthog.com` or EU equivalent |
| `VITE_SESSION_REPLAY` | `true` or `false` |

Change `VITE_SESSION_REPLAY` → redeploy → replay on or off globally.

**Note:** PostHog dashboard can also disable replay without redeploying; env var is the
“we control it in our deploy” switch.

### Runtime control (recommended in addition)

Even when replay is enabled globally, start/stop around sensitive or non-practice screens:

```ts
// Parent opens Settings ("For grown-ups")
posthog.stopSessionRecording();
posthog.capture("screen.viewed", { screen: "settings", session_subject: "parent" });

// Child starts learning
posthog.startSessionRecording();
posthog.capture("practice.session_started", { session_subject: "learner", learner_id });
```

This keeps replays focused on **learner practice**, not caregiver configuration.

---

## Mapping existing events to PostHog

Current `AppEvent` types in `src/config/events.ts`:

- `task.succeeded`
- `task.mistake`
- `hesitation`
- `level.replayed`
- `level.started`
- `level.completed`

Suggested capture shape:

```ts
onEvent((event) => {
  const { type, ...properties } = event;
  posthog.capture(type, {
    ...properties,
    learner_id: getActiveLearnerId(),
    session_subject: "learner",
  });
});
```

Optional custom performance events (not automatic anywhere):

```ts
posthog.capture("audio.latency", { ms: 120, note: "C" });
```

---

## Suggested beta user flow

1. Parent signs up (auth provider TBD in final plan).
2. Parent accepts beta terms + session replay notice (once, caregiver-facing).
3. Parent creates or selects a learner profile.
4. App calls `posthog.identify(parentUserId, …)` and tags events with `learner_id`.
5. Replay runs during practice; stops on Settings / logout.
6. You review Activity, Insights, and Replays in PostHog filtered by `learner_id` / cohort.

---

## Privacy & compliance (children’s app)

This app is for autistic children. For beta:

- Use **parent/guardian accounts**, not child accounts.
- Add a short **privacy / beta notice** for caregivers (replay, what's collected, retention).
- **Avoid child PII in PostHog:** no real names, age, school — use opaque `learner_id`.
- **Session replay on for now** — document in consent; plan to disable via env var if needed.
- Prefer **invite-only beta** over open signup.
- Choose **PostHog EU cloud** if beta testers are primarily in Europe (GDPR).
- Support **data deletion requests** per parent account (PostHog supports this).

---

## Cost snapshot (typical small beta)

| Service | Expected beta cost |
|---------|-------------------|
| Vercel Hobby | $0 |
| PostHog Cloud (events + replay within free tier) | $0 |
| Clerk or Supabase Auth (free tiers) | $0 |
| Vercel Analytics | ~$20/mo if wanted (optional) |
| Sentry | $0 on free tier (optional) |

Paid usage only if you exceed free tier limits or add Pro features.

---

## Suggested implementation order (for final plan)

High-level sequence only — refine when writing the final plan MD.

1. **PostHog project** — create project (US or EU), note API key and host.
2. **`initAnalytics` module** — env-based init, session replay flag, identify/register helpers.
3. **Event forwarder** — subscribe in `recorder.ts` or sibling module; attach `learner_id`.
4. **Identity** — extend `getUserId()` for parent id; add `getActiveLearnerId()` for profiles.
5. **Learner profile UI** — picker on start (before or after auth, per final plan).
6. **Auth** — parent login gate (Clerk vs Supabase: decide in final plan).
7. **Replay boundaries** — `startSessionRecording` / `stopSessionRecording` around practice vs Settings.
8. **Vercel** — env vars, deploy, smoke-test captures in PostHog Live Events.
9. **Caregiver consent copy** — beta notice + replay disclosure (static screen or modal).
10. **Dashboards** — basic PostHog insights (levels completed, mistake rate, active beta users).

---

## Open decisions (resolve in final plan)

- [ ] Auth provider: **Clerk** vs **Supabase Auth** vs invite-only without full auth initially
- [ ] PostHog region: **US** vs **EU** cloud
- [ ] Learner profiles: local-only vs synced to backend under parent account
- [ ] Whether to add **Sentry** in the same pass or later
- [ ] Beta access: open signup vs email invite list
- [ ] Consent UX: modal on first login vs dedicated beta onboarding screen
- [ ] Whether parent email is stored in PostHog person properties or kept auth-only
- [ ] Default learner profile naming (“Learner 1”) vs optional nickname only in local storage

---

## References

- PostHog docs: [How PostHog works (ClickHouse)](https://posthog.com/docs/how-posthog-works/clickhouse)
- PostHog pricing: [posthog.com/pricing](https://posthog.com/pricing)
- PostHog data export: [Data import and export](https://posthog.com/docs/getting-started/data-import-export)
- Vercel deployment: standard Vite static build (`npm run build` → `dist/`)

---

*Draft for review. Not the final implementation plan.*
