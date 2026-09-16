# Building the Site at Container Startup

[Русский](frontend_startup_build.md) · **English**

## Operational characteristic

The `vedal-site` container does not receive a prebuilt frontend image. It runs
`npm run build` on every start. Deployment starts `portal` before `site`, so
the website build calls the already running Public API through
`VEDAL_API_INTERNAL_URL`.

This makes build-time API availability and semantics part of frontend startup:

- an already built website keeps working without the portal;
- a new `site` container cannot become healthy when a required build-time
  request receives an unexpected error;
- a local `next build` without `NEXT_PUBLIC_API_URL` and
  `VEDAL_API_INTERNAL_URL` does not exercise this path: `apiConfigured` is
  false and the build uses fallback data from `frontend/content/*.ts`.

## Incident on 16 September 2026

The first rollout of the changes made the public website unavailable for about
ten minutes. The portal started with the public documents section disabled and
returned `404` from `GET /api/public/v1/documents`. The following website build
treated every non-`2xx` response as fatal. `npm run build` failed,
`vedal-site` remained unhealthy, and public pages returned `500`. Autodeploy
repeated the same cycle every two minutes.

Hotfix `6268307` established the distinction between states:

- `404` from the document listing means that the section is closed by its
  switch; `fetchDocuments` returns an empty list and the build continues;
- `5xx` still means a portal failure and stops the build;
- two scenarios are covered in `frontend/lib/api.test.ts`.

The `404` handling follows the existing `fetchProduct` and `fetchNewsEntry`
idiom: a missing or withdrawn public resource is a domain state, not an
infrastructure failure.

## Pre-deployment check

1. Before changing a public switch, verify its value for both containers using
   the [switch table](public_feature_switches.en.md).
2. Run the frontend tests, including `frontend/lib/api.test.ts`.
3. Exercise a build with the internal API configured, not only the local
   fallback-data mode.
4. After startup, check both process health states, representative page status
   codes, and the expected status of closed public doors.
5. Do not turn `5xx` into empty content: doing so would hide a real portal
   failure and release an incomplete build.

The autodeploy flow is documented separately in
[autodeploy.en.md](autodeploy.en.md).
