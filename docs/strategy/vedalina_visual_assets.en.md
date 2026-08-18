# Vedalina Visual Assets

[Русский](vedalina_visual_assets.md) · **English**

## Generated Assets

Workspace assets:

- `assets/vedalina/vedalina-avatar-concepts-v1.png`
- `assets/vedalina/vedalina-avatar-left-v1.png`
- `assets/vedalina/vedalina-avatar-middle-v1.png`
- `assets/vedalina/vedalina-avatar-right-v1.png`
- `assets/vedalina/vedalina-web-integration-mockup-v1.png`

Prototype:

- `prototypes/vedalina-web-interface.html`

## Recommended Choice

Use `vedalina-avatar-middle-v1.png` as the MVP avatar direction.

Reason:

- calm and assistant-like;
- not too clinical;
- not too fantasy-heavy;
- works well inside a small circular web widget.

Alternative positioning:

- `vedalina-avatar-left-v1.png`: more medical/clinical, if NN wants the assistant to feel closer to the equipment domain.
- `vedalina-avatar-right-v1.png`: more celestial/muse-like, if NN wants the Vedalina mythology to be more visible.

## Web Integration

Vedalina should appear in two places:

1. Hero assistant card on the first screen, secondary to the main product/production headline.
2. Floating assistant button in the lower-right corner after scroll.

Quick actions:

- Подобрать оборудование
- Найти документ
- Запросить КП
- Сервис

Important limitation:

The generated web mockup is a visual direction only. The final UI must be rebuilt in code with exact approved text, no generated text artifacts, and no unapproved claims.

## Prompt Record

Avatar concept prompt:

```text
Create a clean concept sheet with 3 circular avatar variants for an AI website assistant named Vedalina, inspired by the Greek muse of astronomy. Calm female AI guide, precise and expert, not a doctor, not fantasy-heavy. Subtle celestial motifs: star map lines, celestial globe, compass, orbit arcs. Polished semi-flat / soft 3D illustration, vector-friendly, suitable for small web avatars. Palette: VEDAL green, teal, white, charcoal, small muted gold accent. No words, no watermark, no logos, no medical cross, no stethoscope, no mystical fortune-teller look.
```

Web integration mockup prompt:

```text
Create a conservative desktop web interface mockup showing how the Vedalina assistant integrates into the first screen of vedal-med.ru. Hero section with VEDAL-style green accents, headline area, two CTA buttons, and a right/lower-right assistant widget named Vedalina with circular avatar, compact chat card, and quick actions. Russian UI text: "Российское медицинское оборудование", "Запросить КП", "Каталог", "Vedalina: помогу найти продукт или документ". No prices, no clinical advice, no invented certifications.
```
