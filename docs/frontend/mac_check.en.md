# Mac Layout Check Checklist

[Русский](mac_check.md) · **English**

Related: [issue #62](https://github.com/michaelwelly/MuseonUrania/issues/62) —
"Layout breaks on a Mac". Without a reproducible case there is nothing to
fix: "it looks off" is not a bug report. This checklist takes five minutes
and produces something we can act on.

## What the code review already fixed

Nobody on the team has a Mac, so the search was not visual but by property:
which constructs in our stylesheets does WebKit parse differently from
Chromium. Five turned up, all fixed on the `front` branch. Worth knowing
before you check: if any of them is still visible, you are looking at an old
build, and the thing to fix is not the CSS.

| What | Works from Safari | How it looked before the fix |
| --- | --- | --- |
| `overflow: clip` on `html` and `body` | 16.0 | page wider than the screen, scrolls sideways |
| `color-mix()` | 16.2 | five places in the chat window with no fill |
| `svh` and `dvh` units | 15.4 | chat window taller than the screen; blank strip under the footer |
| unprefixed `appearance` | 15.4 | the "Изделие" dropdown shorter than the fields next to it, with its own arrow |
| field font size under 16px | — | tapping a field zooms the page in and it never zooms back |

The versions come from `caniuse-lite`, the very database the project builds
against, not from memory.

Which makes one thing the priority here: **the Safari version is the most
valuable line in the report.** A Mac that cannot go past macOS Catalina
stops at Safari 15.6.1, and the first three rows hit it directly. A Mac on
a current system was never affected by them — in which case the cause is
something else, and the screenshot matters even more.

## Before you start

1. Open the page in a **private window** (Safari: Cmd+Shift+N, Chrome:
   Cmd+Shift+N) — this rules out stale cache or cookies as the cause.
2. Confirm the URL is the current stand address (the one the team gave you,
   not an old bookmark).
3. Write down:
   - browser and version (Safari → menu → "About Safari"; Chrome → menu ⋮ →
     "Help" → "About Google Chrome");
   - macOS version (menu → "About This Mac").

## Pages to check

Open these one by one and, for each, do what's described in "What to
capture":

1. `/` — home
2. `/about/` — about
3. `/products/` — catalog
4. `/products/vedal-a-2000/` — product page
5. `/production/` — production
6. `/service/` — service
7. `/documents/` — documents
8. `/news/` — news
9. `/contacts/` — contacts

## Which widths to check

Two passes — on a Mac the problem is often the window width itself, not the
browser:

1. **Window maximized to full screen.**
2. **Your normal working window width** — the one the browser was actually
   in when the glitch was noticed (for example, half the screen next to
   another app). This is the case nobody has checked on Windows.

For each pass, on each page:

1. Open Web Inspector (Option+Cmd+I in Safari, Option+Cmd+I in Chrome) →
   Console tab.
2. Paste and run:

   ```js
   [window.innerWidth, document.documentElement.scrollWidth - document.documentElement.clientWidth]
   ```

3. Screenshot the result (two numbers: window width and horizontal
   overflow). If the second number is greater than zero, the page has real
   horizontal scroll — that is the reproducible bug.
4. Take a full-page screenshot (not just the visible part — in Safari:
   Shift+Cmd+4, then Space, then click the window; or use a full-page
   screenshot extension).

## What to look at first

On every screenshot, in this order:

- **Header/navigation** — do menu items overlap, is the logo clipped, does
  the mobile menu appear at desktop width?
- **Hero (first screen)** — does the headline and CTA button fit, does text
  overflow the datasheet card?
- **Catalog cards** (`/products/`) — does the photo shift, does the
  price/name overflow the card, are the rows even?
- **Documents table** (`/documents/`) — does the table header overlap rows
  on scroll, does the table spill horizontally, are the filter chips
  readable?
- **Footer** — do the link columns shift, is any text clipped?

## What still needs a live Mac

The fixes in the table above were verified by property analysis and a run in
Chromium, where the result did not change. What analysis cannot verify:

- **The sticky header on old Safari.** The fallback for `overflow: clip`
  puts the clipping on `html`, not on `body`, precisely so the header keeps
  sticking. Chromium confirms the difference by substitution: with clipping
  on `html` the header stays put at a scroll of 900 pixels, with clipping on
  `body` it scrolls away with the page. WebKit follows the same spec rule,
  but nobody has seen it with their own eyes. **Scroll any long page and
  check whether the header stays.**
- **The chat window on an iPhone** — does it fit, is the close button visible.
- **The row of fields on `/service/`** — are the text field and the "Изделие"
  dropdown the same height, is the dropdown arrow visible.
- **Fallback font metrics.** While our own fonts load, the page is set in a
  system font whose metrics Next adjusts to match ours — `size-adjust` goes
  as high as 136%. WebKit picked that adjustment up later than Chromium, so
  on old Safari the first fractions of a second are set noticeably narrower.
  A screenshot taken at that moment looks like "everything is broken" even
  though it settles an instant later. **If the breakage disappears after a
  reload, this is the cause, and it is not in the table above.**

## How to attach it to the issue

In a comment on [issue #62](https://github.com/michaelwelly/MuseonUrania/issues/62),
report for every case found:

- the page (exact path);
- the window width (the number from the console, step 2 above) and whether
  it was "full screen" or "working width";
- browser, version, macOS version;
- a screenshot — drag the file straight into the GitHub comment box;
- if the console showed overflow (second number above zero), state the
  number itself — that is the key piece of evidence.

A screenshot without the window width and the console numbers gives nothing
to grab onto — it just brings back the same question: "at what width?"
