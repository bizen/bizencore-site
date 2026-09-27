# bizencore-site

The brand site for [bizencore.com](https://bizencore.com) — *Utopia orchestrator.*

A single static page built with three.js. You enter through a monolith in a pale, misty lake and arrive at **The Orchestrator**, an armillary sphere whose axis is a double helix. The camera follows the machine's shape: it drops through the polar ring, rides the rail around the core where the works are mounted, and climbs the helix to the pole star.

## Structure

- `index.html` — the whole site (HTML, CSS, and a three.js module). Libraries load from CDNs: three.js, GSAP, Lenis, and Google Fonts.
- `img/` — the sky backdrop and work key visuals, generated with Higgsfield (FLUX.2).
- `docs/style-board/` — the style study that led to the direction.

## Run locally

Open it through any static server (images fail to load from `file://`):

```sh
npx serve .
```

## Deploy

Static hosting with no build step. On Vercel, import the repo and deploy as is.
