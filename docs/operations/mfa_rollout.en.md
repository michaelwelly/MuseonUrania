# Enabling MFA in Keycloak and the `/admin` decision

[Русский](mfa_rollout.md) · **English**

Closes issue #42 and open question 12.3 from [PROJECT.en.md](../PROJECT.en.md).
Everything that lives in the repository is done and verified. **On the live
Keycloak the mandatory second factor is not switched on yet** — that is a
separate step, taken by the owner of the machine, and the order is written out
below.

## What was decided

1. **The second factor is mandatory for whoever has access to personal data,
   and it is the realm file that decides this, not the memory of whoever
   creates the account.** It used to rest on a person remembering to assign
   `CONFIGURE_TOTP` by hand to every new employee. Now it is tied to a role.
2. **`/admin` is held by a password and a second factor; the network is a
   second, independent layer where the proxy is ours.** That is the answer to
   "close it by network or leave it behind a password and MFA": not "or", but
   "first the thing that works everywhere".

## Who needs the second factor

| Role | Second factor | Why |
| --- | --- | --- |
| `portal-admin` | required | sees everything, including the staff directory and the right to destroy personal data |
| `portal-sales` | required | the closed contour of sales: leads, clients, deals, quotes |
| `portal-production` | not required | site content; does not see the client base |

## What is in the repository

`backend/keycloak/stand/vedal-realm.json` and
`backend/keycloak/prod/vedal-realm.json` (branch `infra`). Three objects:

1. **The `portal-mfa-required` marker role.** It grants nothing.
   `portal-admin` and `portal-sales` include it as a composite, so the list of
   "who needs a second factor" is edited in one place rather than account by
   account. A fourth role with access to personal data gets the composite, and
   that is all.
2. **The `vedal-browser` sign-in flow.** A copy of the built-in `browser` with
   a single substitution: in the `Browser - Conditional OTP` subflow the
   `conditional-user-configured` condition is replaced with
   `conditional-user-role` configured as `condUserRole=portal-mfa-required`.

   That is the whole point of the change. The built-in condition means "ask for
   a code from whoever already has one" — that is, it requires a second factor
   from nobody who has not set one up voluntarily. The role condition means
   "ask whoever is supposed to be asked".
3. **`browserFlow: vedal-browser`** in the realm itself — otherwise the flow
   exists but is never used.

The OTP form inside the subflow is `REQUIRED`. That is what enforces it: anyone
without an authenticator app bound lands, after a correct password, not in the
admin panel but on the enrolment screen.

Along with that:

- **the direct password grant is disabled for `vedal-admin-ui` in `stand/` and
  `prod/`** (`directAccessGrantsEnabled: false`). It bypasses the browser
  flow — that is, the second factor — and would have been a one-`curl`-line way
  around everything listed above. Neither the admin panel (authorization code +
  PKCE) nor the portal (`client_credentials`) uses it. The local realm keeps
  it: there is no second factor there, so there is nothing to bypass;
- **`CONFIGURE_TOTP.defaultAction` on the stand is brought to `false`**, as in
  `prod`. `true` forced enrolment on every new account indiscriminately,
  including `portal-production`, which sees no personal data;
- **the password policy and brute force detection** were already in `stand/`
  and `prod/` before this task: length 12 or more, not the username, not the
  email, a history of 3 passwords, a special character, an uppercase letter, a
  digit; lockout after 10 failures with a growing pause up to 15 minutes, no
  permanent lockout (a permanent one turns guessing someone's password into a
  way to lock that person out);
- **the local realm** (`backend/keycloak/vedal-realm.json`) is untouched: on a
  developer machine a second factor gets in the way and protects nothing.

## What was verified on the local stack — 8 September

Keycloak 26.0, container `vedal-keycloak`. The working `vedal` realm was **not
touched**: the checks ran in separate temporary realms, created and deleted
within the same session.

### The file imports and produces the expected layout

`stand/vedal-realm.json` was imported as a new realm. The `vedal-browser` flow
assembled in full, `conditional-user-role` picked up its
`condUserRole=portal-mfa-required` configuration, the composites landed on
`portal-admin` and `portal-sales`, `portal-production` stayed without them, and
`directAccessGrantsEnabled: false` reached the client.

**A trap found right here:** the first version of the role description was 262
characters long, and the import failed not on parsing JSON but with a database
error — `Value too long for column "DESCRIPTION CHARACTER VARYING(255)"`. Role
and flow descriptions in the realm file must fit into 255 characters.

### Behaviour by role

Three accounts were created with the same password and different roles, and the
sign-in was driven for real — a request to `openid-connect/auth`, a POST of the
login form, and a reading of the answer:

| Account | Role | What Keycloak returned after a correct password |
| --- | --- | --- |
| `chk-admin` | `portal-admin` | a redirect to `login-actions/required-action?execution=CONFIGURE_TOTP`, no authorization code |
| `chk-sales` | `portal-sales` | the same |
| `chk-prod` | `portal-production` | a redirect to `redirect_uri` with an authorization code |

### The full loop with a real one-time code

For `chk-admin` the whole chain was walked: the enrolment screen → the secret
from the page → a code computed per RFC 6238 → the form submitted. Enrolment
was accepted and an authorization code issued. **A subsequent sign-in with the
correct password alone then returns the one-time code form, not an
authorization code.** So the second factor is not only forced on the first
sign-in but asked for on every following one.

### The direct password grant

`grant_type=password` for `vedal-admin-ui` in a realm built from the file
returns `unauthorized_client` / `Client not allowed for direct access grants`.
The way around the second factor is closed.

### Password policy and brute force detection

- An attempt to set the password `short` was rejected:
  `must contain at least 1 special characters`.
- 11 failed attempts in a row on one account → `attack-detection` reports
  `"disabled": true`, and the **correct** password then gets a `401`. A
  noticeable detail: with a rapid burst of attempts `numFailures` is 2, not 11 —
  Keycloak collapses attempts that come too fast
  (`quickLoginCheckMilliSeconds`). The lockout still engages.

### The rollout order on a live realm — walked end to end

A separate temporary realm was brought to the state of the live stand (the old
file imported, two accounts created in advance and signing in with a password
alone), and then exactly the commands listed below in "What Mikhail does" were
run on it. The result:

- an account created in advance with the `portal-admin` role requires a second
  factor after the migration — **it was not touched and nothing was assigned to
  it**;
- the `portal-production` account keeps signing in with a password alone;
- a one-command rollback (`browserFlow=browser`) immediately restores password
  sign-in, and switching it back on is one command too.

That is the main practical consequence: **existing employees need nothing
assigned to them.** They already have the role, and it is the flow that demands
the second factor.

## The actual check on the stand — 7 September

Checked on the live Keycloak (`51.250.31.97`, container `vedal-keycloak`) on
the eve of the handover to the customer. Mandatory MFA **was not switched on** —
only a comparison of state and two safe items.

### The divergence from the file in git

| Setting | In the git file | On the stand before the check |
| --- | --- | --- |
| `passwordPolicy` | `length(12)` + history 3 + special + uppercase + digit | not set at all |
| `bruteForceProtected` | `true`, `failureFactor: 10` | `false`, `failureFactor: 30` (the Keycloak default) |
| `otpPolicyType` | `totp` | `totp` — matches |
| `CONFIGURE_TOTP.defaultAction` | `false` | `false` — matches |
| `sslRequired` | `all` | `none` — an expected divergence: there is no HTTPS on the stand |

The reason is the same everywhere: the realm on the stand was created by
`--import-realm` once, and edits to the file do not reach it without being
applied by hand.

### What was applied

The password policy and brute force detection. Neither is checked against an
existing password — only when one is being guessed or changed — so sign-in for
working accounts does not break:

```bash
docker exec vedal-keycloak /opt/keycloak/bin/kcadm.sh update realms/vedal \
  -s "passwordPolicy=length(12) and notUsername(undefined) and notEmail(undefined) and passwordHistory(3) and specialChars(1) and upperCase(1) and digits(1)" \
  -s bruteForceProtected=true \
  -s permanentLockout=false \
  -s failureFactor=10 \
  -s waitIncrementSeconds=60 \
  -s maxFailureWaitSeconds=900
```

### The TOTP mechanics check

A one-off account `mfa-smoke-test` was created with `requiredActions:
["CONFIGURE_TOTP"]`, a token request with the correct password returned
`HTTP 400` `invalid_grant` / `Account is not fully set up`, and the account was
deleted right after the check. Nothing was assigned to real employees.

## What Mikhail does on the machine

Whoever prepared the change has no access to the machine. Below is what has to
be run on `51.250.31.97` for the above to take effect. There is no password
anywhere in the text: `kcadm.sh config credentials` without `--password` asks
for it itself, which is why the first step goes through `docker exec -it`.

The order matters: the role first, then the flow, and binding it last. Until
the flow is bound to the realm nothing about sign-in changes, so the first
three steps are safe and reversible on their own.

### 0. Sign in to kcadm

```bash
docker exec -it vedal-keycloak /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://127.0.0.1:8080 --realm master --user admin
```

The Keycloak admin password is typed into the prompt. The session lives inside
the container; `-it` is not needed after this.

### 1. Take a rollback point

```bash
docker exec vedal-keycloak /opt/keycloak/bin/kcadm.sh get realms/vedal \
  > /tmp/vedal-realm-before.json
docker cp vedal-keycloak:/tmp/vedal-realm-before.json ./vedal-realm-before.json
```

This is the state of the realm, not the accounts: **it does not contain and
does not replace a dump of the employees.** It exists so that there is
something to compare against if things go sideways.

### 2. The marker role and the composites

```bash
KC="docker exec vedal-keycloak /opt/keycloak/bin/kcadm.sh"

$KC create roles -r vedal -s name=portal-mfa-required \
  -s 'description=Marker: has access to personal data, needs a second factor.'
$KC add-roles -r vedal --rname portal-admin --rolename portal-mfa-required
$KC add-roles -r vedal --rname portal-sales --rolename portal-mfa-required
```

Check:

```bash
$KC get roles/portal-admin/composites -r vedal --fields name
```

It should return `portal-mfa-required`.

### 3. The sign-in flow

```bash
OTP='vedal-browser%20Browser%20-%20Conditional%20OTP'

$KC create authentication/flows/browser/copy -r vedal -s newName=vedal-browser

COND=$($KC get "authentication/flows/$OTP/executions" -r vedal \
  --fields id,providerId --format csv --noquotes | tr -d '\r' \
  | awk -F, '$2=="conditional-user-configured"{print $1}')
$KC delete "authentication/executions/$COND" -r vedal

$KC create "authentication/flows/$OTP/executions/execution" -r vedal \
  -s provider=conditional-user-role
NEW=$($KC get "authentication/flows/$OTP/executions" -r vedal \
  --fields id,providerId --format csv --noquotes | tr -d '\r' \
  | awk -F, '$2=="conditional-user-role"{print $1}')

$KC create "authentication/executions/$NEW/config" -r vedal \
  -s alias=vedal-mfa-role \
  -s config.condUserRole=portal-mfa-required -s config.negate=false
$KC create "authentication/executions/$NEW/raise-priority" -r vedal
$KC update authentication/flows/vedal-browser/executions -r vedal -n \
  -s id="$NEW" -s requirement=REQUIRED
```

Check — exactly two executions should remain in the subflow, both `REQUIRED`,
the condition first:

```bash
$KC get "authentication/flows/$OTP/executions" -r vedal \
  --fields index,displayName,providerId,requirement
```

The same by clicking, if that feels calmer step by step: Authentication →
`browser` → Action → Duplicate → name `vedal-browser` → in the
`Browser - Conditional OTP` subflow delete `Condition - user configured` →
Add condition → `Condition - user role` → Requirement `Required` → the gear
icon → alias `vedal-mfa-role`, role `portal-mfa-required`.

### 4. Binding the flow — the moment behaviour changes

```bash
$KC update realms/vedal -s browserFlow=vedal-browser
```

From this second on, `portal-admin` and `portal-sales` get the authenticator
enrolment screen on their next sign-in.

### 5. Try it on yourself first — before anyone else finds out

Sign out of the admin panel, sign back in with your own `portal-admin` account,
go through enrolment: scan the QR code with an app (Google Authenticator,
Yandex Key, FreeOTP — any RFC 6238 TOTP), type the six-digit code. Make sure
the sign-in goes through and the admin panel opens.

**If it does not — step 4 is rolled back with one command (see "Rollback"), and
you do not go further.**

### 6. Warn the others

Not after the fact. On their next sign-in, an employee with the `portal-admin`
or `portal-sales` role meets the enrolment screen instead of the usual
password. Without a warning that looks like a broken sign-in.

Nothing has to be assigned to anyone in the process: people already have the
role.

### 7. Disable the direct password grant

```bash
CID=$($KC get clients -r vedal -q clientId=vedal-admin-ui --fields id \
  --format csv --noquotes | tr -d '\r')
$KC update "clients/$CID" -r vedal -s directAccessGrantsEnabled=false
```

This goes last, because until this moment `grant_type=password` is a working
way to check that a password is accepted at all, bypassing the browser screen.
After step 5 it is no longer needed, and left enabled it is a way around the
second factor.

## Rollback

| What happened | What to do |
| --- | --- |
| Sign-in broke for everyone | `$KC update realms/vedal -s browserFlow=browser` — sign-in returns to the password immediately, deleting nothing. Verified. |
| One person cannot pass OTP (lost the phone, clocks drifted) | Admin Console → Users → the user → Credentials → delete the OTP credential. On the next sign-in the flow offers enrolment again. |
| The second factor has to come off one specific person, leaving the others | Remove their `portal-admin`/`portal-sales` role, or (if the role is needed) drop the composite from the role itself — but then the factor disappears for everyone holding it. For a one-off, the first is more honest. |
| The direct password grant has to come back | `$KC update "clients/$CID" -r vedal -s directAccessGrantsEnabled=true` |

A full rollback in reverse order: unbind the flow, restore
`directAccessGrantsEnabled`, drop the composites, delete the role and the flow.
The first item alone is enough for people to keep working — the rest can be
untangled without hurry.

## The `/admin` decision: network, or password and MFA

Question 12.3 from [PROJECT.en.md](../PROJECT.en.md) is closed like this: **the
main barrier is a password and a second factor; the network restriction is a
second, independent layer where the proxy is ours.**

Why not the other way round, even though the network looks stronger:

1. **The network only works where the proxy is ours.** In the target deployed
   environment that is Caddy and the `@admin` rule in
   `backend/proxy/Caddyfile`. On the stand (`51.250.31.97`) there is no Caddy
   at all: the admin panel is served by a shared nginx that sits on the same
   machine next to somebody else's production sites. A network restriction
   there would have to be made by somebody else's hands — asking the owner of
   that nginx to edit their config for the sake of our door. A barrier that
   depends on somebody else's schedule is not a barrier.
2. **The second factor is the same everywhere.** It lives in the realm file,
   travels with the realm into both the stand and the deployed environment,
   and after this change does not depend on anyone remembering to assign it to
   a particular person.
3. **The network is not being removed.** The default in the `Caddyfile` is
   `private_ranges`, and it stays: it costs nothing and cuts off what never
   even reaches the login form. Of the two possible mistakes — a door wrongly
   closed breaks the editor's work and is visible within a minute, a door
   wrongly opened breaks nothing and is never visible — the default is the one
   that gets noticed.
4. **The network layer may be removed, but not before the second factor is
   confirmed working** for every holder of `portal-admin` and `portal-sales`.
   It is one variable:

   ```
   VEDAL_ADMIN_ALLOW="0.0.0.0/0 ::/0"
   ```

   The point of it is access to editing from outside the office and without a
   VPN. That is operational convenience, not a security requirement, and the
   decision is a separate one, the owner's.

What remains true and should be said plainly: **until the steps above are
carried out, the stand's admin panel is open to the internet and rests on a
single password.** There is neither Caddy nor a second factor there right now.
That is exactly why enabling the second factor is the first thing worth doing
after the handover, rather than "some day".

## Traps already stumbled over

- **`--import-realm` does not overwrite an existing realm.** Edits to
  `vedal-realm.json` will not appear on a running Keycloak from a container
  restart or an image rebuild. Hence the whole "What Mikhail does" section: the
  file is the source of truth for a clean install, a live realm is edited with
  commands.
- **Recreating the `vedal-keycloak` volume wipes the accounts** created in the
  console. That is not a way to "apply the file".
- **Role and flow descriptions must be no longer than 255 characters**, or the
  realm file import fails with a database error rather than a parse error.
- **`defaultAction` only affects new users** and is assigned at the moment the
  account is created. That is precisely why the second factor is enforced by a
  flow rather than by a default required action.
- **The direct password grant bypasses the browser flow.** Any second factor
  configured in the browser flow is worked around by it as long as it is
  enabled.
