# Documentation rules

[Русский](documentation_rules.md) · **English**

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
6. **Code blocks are copied verbatim**, including their Russian comments and UI
   strings: they must match the code in the repository. Only the prose around
   them is translated.
7. Project terms are not translated ad hoc — see the glossary below.

Exception: `CLAUDE.md` and `AGENTS.md` do not go into the repository, they are in
`.gitignore` as tooling-generated files. That is why these rules live here rather
than in them.

## Glossary

| Russian | English | Do not translate as |
| --- | --- | --- |
| закрытый контур | closed contour | private circuit |
| открытый офис | open office contour | — |
| заявка / лид | lead | application, request |
| КП | quote | commercial proposal |
| согласовано / опубликовано | approved / published | — |
| датащит | datasheet | — |
| дверь (API entrance) | entry point, door | — |
| порт (outward interface) | port | — |
| журнал / аудит | audit log | journal |
| перечень документов | document listing | — |
| передача человеку | handoff to a human | — |
| ожидает уточнения | awaiting clarification | — |
| сид / наполнение каталога | seed | — |
| сборка сайта | site build | — |

Interface strings and labels that a visitor sees stay in Russian in the English
version and are put in quotes: `«Запросить КП»`, `«ожидает уточнения»`. They are
not a translation, they are a fact about the product.

## How to check that nothing has drifted

Files without a counterpart:

```bash
for f in $(git ls-files '*.md' | grep -v '\.en\.md$'); do b="${f%.md}"; [ -f "$b.en.md" ] || echo "no EN: $f"; done
for f in $(git ls-files '*.en.md'); do b="${f%.en.md}"; [ -f "$b.md" ] || echo "no RU: $f"; done
```

Russian text accidentally left in an English version outside code blocks:

```bash
awk '/^```/{inb=!inb; next} {if(!inb) print FILENAME":"NR": "$0}' $(git ls-files '*.en.md') | grep '[а-яА-Я]'
```

The second check always reports the language switcher and the deliberately
preserved interface strings — they have to be told apart from a forgotten
translation by eye.
