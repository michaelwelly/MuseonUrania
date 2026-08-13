# Claude Frontend Prompt

[Русский](claude_frontend_prompt.md) · **English**

Use this prompt to generate three frontend interface variants for the first release.

```text
You are building three frontend concepts for VEDAL, a Russian medical equipment manufacturer.

Primary domain:
vedal-med.ru

Business goal:
Turn the current public website into a conservative B2B product and sales interface for medical equipment. The site must inform, support product discovery, capture quote/catalog/service requests, and prepare for CRM/S3/AI integration.

Audience:
B2B buyers, medical organization representatives, dealers/integrators, service contacts, stakeholders.

Core pages:
1. Home
2. Products
3. Product detail
4. Production
5. Documents
6. Press center
7. Partners
8. Service
9. Contacts

Mandatory first-screen requirements:
- Redesign the title/hero section.
- Keep VEDAL as the primary brand.
- Show Russian medical equipment production clearly.
- Include primary CTA: "Запросить КП".
- Include secondary CTA: "Каталог".
- Reserve a visible but secondary area for the public assistant Urania.
- Use product/production visuals as evidence.

Urania assistant:
- Public website assistant named Urania.
- Inspired by the muse of astronomy.
- Visual motifs: celestial globe, compass, star map, subtle orbit lines.
- Use recommended MVP avatar: assets/urania/urania-avatar-middle-v1.png.
- Placement: hero assistant card and floating lower-right button.
- Quick actions: "Подобрать оборудование", "Найти документ", "Запросить КП", "Сервис".
- Urania must not provide diagnosis, treatment advice, unapproved specifications, prices, delivery times, certification claims, or private documents.
- All factual answers must come from approved public pages/documents.

Smart Solution:
- Show Smart Solution only as a secondary technology integration layer.
- Role: forms to CRM, S3/document metadata, future AI search.
- Do not make Smart Solution visually stronger than VEDAL.

Frontend variants:

Variant A: Conservative Manufacturer
- Most suitable for first stakeholder presentation.
- Trust, production, documents, certification blocks, clear CTAs.

Variant B: Product-Led Catalog
- Product cards, categories, filters, fast quote/catalog flow.
- Catalog discovery is the center of the UI.

Variant C: Expert Technology Platform
- Production/R&D capability, international readiness, Smart Solution and Urania as technology layer.
- Keep claims conservative and approved-only.

Design constraints:
- Conservative B2B medical/industrial style.
- White, VEDAL green, teal, charcoal, light gray.
- No decorative gradient hero.
- No fantasy visual dominance for Urania.
- No prices.
- No invented certificates.
- No clinical claims.
- No fake technical specifications.
- No marketing fluff.
- Text must fit responsively.
- UI must be production-implementable, not only a concept image.

Use these assets:
- assets/urania/urania-avatar-middle-v1.png
- assets/urania/urania-avatar-left-v1.png
- assets/urania/urania-avatar-right-v1.png
- assets/urania/urania-web-integration-mockup-v1.png as direction reference only, not final UI

Placeholder policy:
Where NN answer is missing, use "ожидает уточнения" or "awaiting NN answer".
Do not fill missing product/certification/price/specification facts yourself.

Deliverables:
1. A concise design rationale for all three variants.
2. Home page layout for each variant.
3. Product listing layout for each variant.
4. Urania assistant UI state for each variant.
5. Recommendation: which variant to show first to NN and why.
```
