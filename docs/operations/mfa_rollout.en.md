# Enabling MFA in Keycloak and the `/admin` decision

[Русский](mfa_rollout.md) · **English**

Prepares and records what issue #42 needs. **Nothing described here is
switched on on the live Keycloak** — this document fixes the plan and the
realm-file change in git; switching it on at `51.250.31.97` is done by the
owner after the customer handoff, as a separate, deliberate step.

## What the prod realm already had

`backend/keycloak/prod/vedal-realm.json` already carried the full technical
foundation for MFA before this change:

| Setting | Value | What it gives |
| --- | --- | --- |
| `passwordPolicy` | length 12+, not the username, not the email, history of 3 passwords, one special character, one uppercase letter, one digit | a decent password as the first factor |
| `bruteForceProtected` | `true`, `failureFactor: 10`, `waitIncrementSeconds: 60`, `maxFailureWaitSeconds: 900`, `permanentLockout: false` | lockout after 10 failures with an increasing pause capped at 15 minutes; no permanent lockout on purpose — otherwise brute-forcing a stranger's password becomes a way to lock an employee out |
| `otpPolicyType` | `totp` (RFC 6238), `HmacSHA1`, 6 digits, 30-second period | the second factor is an authenticator app (Google Authenticator, Yandex Key, FreeOTP and similar), not SMS or a phone call |
| `sslRequired` | `all` | login only over HTTPS, unlike `none` on the stand |
| Required action `CONFIGURE_TOTP` | present, `enabled: true` | forces the authenticator-app setup screen on whoever this action is assigned to |

In other words: **the second-factor type is already chosen (TOTP), and the
password policy and brute-force protection are already configured.** What
was missing was the decision on who exactly must have the second factor,
and that decision being recorded in code rather than assumed.

## What was missing, and what changed

`CONFIGURE_TOTP` had `"defaultAction": true` — this turned on the mandatory
second factor for **every** new account regardless of role, including
`portal-production`, which has no access to personal data. Issue #42 asks
for a second factor for roles with access to personal data, not for
everyone across the board.

The change (branch `infra`, `backend/keycloak/prod/vedal-realm.json`):

```diff
-      "defaultAction": true,
+      "defaultAction": false,
```

`defaultAction: false` does not disable MFA — the `CONFIGURE_TOTP` required
action stays in the realm and still forces TOTP setup on whoever it is
assigned to. What changes is only the moment of assignment: not
automatically for every new user, but explicitly, by whoever creates or
updates the account, based on role.

**Who the second factor is mandatory for:**

| Role | MFA | Why |
| --- | --- | --- |
| `portal-admin` | mandatory | sees everything, including the staff directory and the right to erase personal data |
| `portal-sales` | mandatory | the sales contour: leads, clients, deals, quotes |
| `portal-production` | optional, not mandatory | site content only, does not see the client base |

The decision is recorded here and in a comment on issue #42, so it does not
live only in chat.

## What happens to already-created users

Nothing — automatically. Two independent facts are at play:

1. **`--import-realm` does not overwrite an existing realm.** If the `vedal`
   realm already exists in the Keycloak database (it does, on
   51.250.31.97), restarting the container with an updated
   `vedal-realm.json` will **not** repeat the import. Changes to the realm
   file must be applied to the live Keycloak by hand: through Admin
   Console → Realm settings → Action → Partial import, or via
   `kcadm.sh update`. There is no "restarted the container and it picked
   up" here — this is the first trap this section exists to flag.
2. **`defaultAction` only affects new users.** A required action with
   `defaultAction: true` (or one assigned by hand) is added to an account
   at the moment it is created. Employees already present in Keycloak need
   `CONFIGURE_TOTP` assigned separately, one at a time or as a list.

## What was actually checked on the stand — September 7

Checked against the live Keycloak (`51.250.31.97`, container
`vedal-keycloak`, `kcadm.sh get realms/vedal`) the night before the
customer handoff. Mandatory MFA **was not switched on** — only a state
comparison and the two safe items below.

### Drift from `backend/keycloak/prod/vedal-realm.json`

| Setting | In the git file | On the stand before the check |
| --- | --- | --- |
| `passwordPolicy` | `length(12)` + history of 3 + special char + uppercase + digit | not set at all |
| `bruteForceProtected` | `true`, `failureFactor: 10` | `false`, `failureFactor: 30` (Keycloak's own default) |
| `otpPolicyType` | `totp` | `totp` — matches |
| `CONFIGURE_TOTP.defaultAction` | `false` (after the issue #42 fix) | `false` — already matches, nothing is forced on anyone |
| `sslRequired` | `all` | `none` — expected drift: the stand has no HTTPS |

The reason for the drift is the same one described above: the realm on
the stand was created once via `--import-realm`, and changes to
`vedal-realm.json` do not reach it without a manual apply.

### What was applied (MFA was neither turned on nor off)

Only the password policy and brute-force protection were added to the
live stand, via `kcadm.sh update realms/vedal`. Neither setting is
checked against an already-stored password — only when someone tries to
guess it or change it — so logging in with an existing password is not
affected:

```bash
docker exec vedal-keycloak /opt/keycloak/bin/kcadm.sh update realms/vedal \
  -s "passwordPolicy=length(12) and notUsername(undefined) and notEmail(undefined) and passwordHistory(3) and specialChars(1) and upperCase(1) and digits(1)" \
  -s bruteForceProtected=true \
  -s permanentLockout=false \
  -s failureFactor=10 \
  -s waitIncrementSeconds=60 \
  -s maxFailureWaitSeconds=900
```

Applied and confirmed with a follow-up `kcadm.sh get`; the admin's own
login into the Keycloak console (`kcadm.sh config credentials`) kept
working unchanged.

**One-command rollback** (restores exactly what the stand had before the
check: no password policy, no brute-force protection):

```bash
docker exec vedal-keycloak /opt/keycloak/bin/kcadm.sh update realms/vedal \
  -s 'passwordPolicy=' \
  -s bruteForceProtected=false \
  -s permanentLockout=false \
  -s failureFactor=30 \
  -s waitIncrementSeconds=60 \
  -s maxFailureWaitSeconds=900
```

### Checking the TOTP mechanism on a throwaway account

Mandatory MFA was not assigned to any real employee. The required-action
mechanism was checked on a throwaway test account, `mfa-smoke-test`,
created and deleted within the same check:

1. The account was created in the `vedal` realm with
   `requiredActions: ["CONFIGURE_TOTP"]` and a permanent password
   (`temporary=false` — so it is specifically TOTP setup being forced,
   not a password change).
2. Requesting a token with the correct password directly
   (`grant_type=password`, client `vedal-admin-ui`) returned `HTTP 400`:
   `{"error":"invalid_grant","error_description":"Account is not fully set up"}`.
   That is the confirmation: the `CONFIGURE_TOTP` required action blocks
   login until the authenticator app is enrolled, even with the correct
   password.
3. The `mfa-smoke-test` account was deleted right after the check — a
   follow-up `kcadm.sh get users -q username=mfa-smoke-test` returns an
   empty list.

Not checked, and not checkable without a browser: the enrollment screen
itself (scanning the QR code, entering the six-digit code) — that is
Keycloak's browser flow, not something visible through a direct
password-grant token request. Step 4 of the rollout order below (trying
it on one live account) is still needed for exactly that part and cannot
be skipped.

## Rollout order

Carried out by the owner, or whoever runs Keycloak, after the handoff —
not before.

1. **Export the current realm from 51.250.31.97** (Admin Console → Realm
   settings → Action → Partial export, include clients, roles and users)
   and keep the copy outside the repository — this is a rollback point,
   not a history archive.
2. **Apply the updated realm file** (`backend/keycloak/prod/vedal-realm.json`
   from the `infra`/`main` branch after merge) via Partial import — the
   password policy, brute-force protection and OTP policy get applied to
   the running realm.
3. **Assign `CONFIGURE_TOTP` to existing employees** holding `portal-admin`
   and `portal-sales`: Admin Console → Users → pick a user → Details tab
   → Required user actions → add Configure OTP → Save. The role list is
   itself the assignment list — check the live realm, don't guess from
   memory.
4. **Try it on one account first.** One employee (ideally whoever runs
   Keycloak) logs in, sees the TOTP setup screen, scans the QR code with
   an authenticator app, enters the confirmation code. Only after that
   login succeeds — move to the next step.
5. **Warn the rest of the staff in advance**, not after the fact: on the
   next login after `CONFIGURE_TOTP` is assigned, they will see the
   authenticator-app enrollment screen instead of the usual password
   prompt. Without warning, that looks like a broken login rather than an
   expected step.
6. **Roll out to the rest** of `portal-admin`/`portal-sales` from the list
   in step 3.
7. `portal-production` — at the owner's discretion, via the same
   procedure, as a separate decision, not automatically bundled with the
   rest.

## How to check it without breaking anyone else's login

- The realm file's JSON is syntactically valid — checked before the
  commit (`node -e "JSON.parse(...)"` raised no errors).
- Keycloak's partial import, by default, does **not** delete what is
  missing from the imported file (users, for instance) — it adds and
  updates entities that match by name. This is not a reason to skip the
  export in step 1: the exact behavior depends on the mode chosen in the
  dialog (skip/overwrite), and so does what happens to any discrepancies.
- Trying it on one account (step 4) is the check. If the login does not
  go through, do not proceed down the list.
- The `/admin` network restriction (see below) stays on during the
  trial: even if something in MFA goes wrong, the editing door does not
  become reachable from the internet — it just becomes unreachable to
  everyone until it is fixed, which is the safer failure mode.

## Rollback if a login breaks

- **One employee cannot get past OTP** (lost phone, device clock drifted):
  Admin Console → Users → the user → Credentials → remove the OTP
  credential. On the next login, if `CONFIGURE_TOTP` is still in Required
  user actions, Keycloak will ask them to enroll again — they set it up
  on a new device.
- **Widespread breakage after applying the realm file**: restore the realm
  from the export taken in step 1 (Partial import the same way, with the
  rollback file instead of the new one).
- **MFA is in the way and there is no time to investigate**: remove
  `CONFIGURE_TOTP` from the affected accounts (Required user actions →
  remove Configure OTP) — this rolls back the mandatory second factor for
  specific people without touching the password, brute-force policy, or
  the `/admin` network restriction. The network restriction keeps
  protecting the editing door on its own regardless.
- In any rollback scenario, **do not lift** `VEDAL_ADMIN_ALLOW` — until
  the second factor is confirmed working for every `portal-admin` holder,
  the network is the only barrier actually holding.

## The `/admin` decision: network or password+MFA

Open question 12.3 from `docs/PROJECT.md` — whether to close `/admin` at
the network level or leave it behind a password and MFA. The `@admin`
rule in `backend/proxy/Caddyfile` already answers it with its default
value, and that is a decision, not a stopgap:

- **By default `/admin` is reachable only from private ranges** —
  `VEDAL_ADMIN_ALLOW` is unset, so `private_ranges` applies. A wrongly
  closed door breaks the editor's work and that is visible within a
  minute; a wrongly opened one breaks nothing and is never seen. The
  safer failure mode is what ships as the default.
- **The network restriction lifts with a single variable**:
  `VEDAL_ADMIN_ALLOW="0.0.0.0/0 ::/0"`. This opens `/admin` to the whole
  internet behind a password and MFA — the other side of the same open
  question.
- **Lifting the network restriction is safe only after MFA is confirmed
  working** for every `portal-admin` holder (step 4 of the rollout order
  above, and beyond). Before that, lifting it means an editor's password
  against the internet — exactly what the comment in `Caddyfile` warns
  against.
- Network and MFA are not mutually exclusive options but two independent
  layers. Nothing requires lifting the network restriction right after
  turning MFA on: keeping both layers at once is safer, and lifting the
  network only buys operational convenience — reaching `/admin` from
  outside the office or a VPN. Whether to lift it is a separate decision
  for the owner, best made no sooner than after a few calm days running
  with MFA.
- On the stand (`51.250.31.97:18080`) there is no Caddy at all — there
  never was a network restriction there and this change does not add
  one; the stand's admin area stays open to the internet until the stand
  moves behind a proxy. That is a separate and more serious problem than
  deferring MFA, and it is not solved within issue #42.
