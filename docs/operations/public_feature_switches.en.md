# Reversible Public Website Switches

[Русский](public_feature_switches.md) · **English**

State as of 16 September 2026. These mechanisms temporarily hide features;
they do not delete data. A switch value, its location, and its restoration
procedure must change together, or the website and portal will expose
different states of the same feature.

| Switch | Location | What it currently hides | How to restore it |
| --- | --- | --- | --- |
| `VEDAL_PUBLIC_DOCUMENTS_ENABLED` | environment variable; passed unchanged to `portal` and as `NEXT_PUBLIC_DOCUMENTS_ENABLED` to `site` | `/documents/`, its navigation and footer links, the home-page documents block, the product-page documents tab, public use of documents by Vedalina, `GET /api/public/v1/documents`, and `GET /api/public/v1/documents/{slug}/file` | set it to `true` for **both** containers and rebuild/restart them. A frontend-only change is insufficient: the portal would keep returning `404` |
| `tagFiltersEnabled` | `frontend/content/news.ts` | the entire category-filter row on `/news/`; the feed remains available | set it to `true` after the categories have publications |
| `PRODUCTION_VIDEO_SRC` | `frontend/content/production.ts` | the video player on `/production/`; the poster frame is shown instead | set an approved video path |
| `PRODUCTION_ARCHIVE_HREF` | `frontend/content/production.ts` | the photo archive link on `/production/` | restore `frontend/app/(site)/production/archive/` and `frontend/content/photo-archive.ts` from Git history, then set `/production/archive/`. Setting the address without the page redirects back to `/production/` |
| `vedal-t-100` filter | `frontend/lib/api.ts`; portal data also keeps the product unpublished | T-100 from the local fallback catalog and direct access to its local product page; in an API-backed environment, public delivery also depends on `published` | approve publication, publish the product in the portal, and remove or adjust both local filters. Either action alone does not cover every run mode |

## Documents: one switch, two processes

The public documents section crosses a container boundary. `site` decides
whether to render the page, links, and tabs. `portal` decides whether the public
doors respond and whether the assistant may use documents in a public
conversation. `VEDAL_PUBLIC_DOCUMENTS_ENABLED` must therefore reach both
processes.

When the section is off, both public document doors return `404` before rate
limiting. The admin section, cards, stored files, and internal index remain in
place. Hiding the storefront does not delete the materials.

See also [building the site at container startup](frontend_startup_build.en.md)
and the [route map](../frontend/sitemap.en.md).
