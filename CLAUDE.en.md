# Repository Working Rules

## Documentation is bilingual

**Every `.md` file in the repository exists in two versions:**

- `FILE.md` — Russian, primary;
- `FILE.en.md` — English, mirror.

A language switcher sits on the first line under the heading of every file:

```markdown
# Заголовок

**Русский** · [English](FILE.en.md)
```

```markdown
# Title

[Русский](FILE.md) · **English**
```

Rules:

1. **A new document is created in both versions at once.** A one-sided file is a
   source of drift: a month later nobody remembers which version is newer.
2. **An edit goes into both versions in one commit.** Not "I will translate it
   later".
3. **The Russian version leads.** When they disagree, it wins: the customer, the
   team and the technical decisions are Russian-language.
4. **Links inside the English version point to English files**
   (`[Spec](spec.en.md)`), links inside the Russian version point to Russian ones.
5. File names, paths, identifiers, table names, field names, topic names and
   routes are **not translated** in either version.
6. Project terms are not translated ad hoc. The shared glossary is at the end of
   this file.

## Glossary

| Russian | English | Do not translate as |
| --- | --- | --- |
| закрытый контур | closed contour | private circuit |
| открытый офис | open office contour | — |
| заявка / лид | lead | application, request |
| КП | quote | commercial proposal |
| согласовано / опубликовано | approved / published | — |
| датащит | datasheet | — |
| дверь (API) | entry point | door |
| порт (интерфейс наружу) | port | — |
| журнал / аудит | audit log | journal |
| перечень документов | document listing | — |
| передача человеку | handoff to a human | — |
| ожидает уточнения | awaiting clarification | — |

## Branches

Layered model: each type of change lives in its own long-running branch.

| Branch | What goes there |
| --- | --- |
| `back` | server logic, Java, backend tests |
| `front` | client, Next.js, styles, frontend tests |
| `db` | migrations, SQL, seed data |
| `infra` | build, CI/CD, Docker, dependencies, deploy scripts |
| `docs` | documentation, specs, presentations |
| `dev` | integration branch, everything is tested together here |
| `main` | tested work only; never committed to directly |

Commits follow Conventional Commits: `type(layer): what was done, imperative`.
Merges into `dev` use `--no-ff`. A merge into `main` happens only after green
tests and explicit approval.

## Content rules

They apply to the website, the admin panel and the assistant's answers:

- do not invent prices;
- do not invent specifications;
- do not invent certificates or registration status;
- do not invent delivery times or availability;
- do not publish clinical claims without approval;
- do not expose internal or confidential documents;
- Urania does not diagnose and does not recommend treatment;
- missing data is marked `ожидает уточнения`, never filled with a plausible
  invention.

## Where to start

The general project documentation is [docs/PROJECT.en.md](docs/PROJECT.en.md).
It covers the essence, the architecture, the repository layout, the current
state and the open questions.
