# MINTLY — Frontend

A luxury marketplace for digital ownership. Built from the Figma "Luxury Redesign"
design system, implemented in **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4**.

## Screens

| Route                 | Screen           | Notes                                                             |
| --------------------- | ---------------- | ----------------------------------------------------------------- |
| `/`                   | Explore          | Hero + featured live auction + "Curated Provenance" gallery grid  |
| `/auctions`           | Auction House    | Gallery listing of all works                                      |
| `/auctions/[id]`      | Auction Detail   | 60/40 split, live countdown, bid panel, bid provenance            |
| `/create`             | Creator Studio   | Canvas + floating toolbar + provenance metadata panel             |
| `/settlement`         | Settlement Flow  | WIN → SECURE → OWN stepper, 10% deposit, Phantom wallet preview    |

## Design system

- **Colours** — bg `#141313`, text `#e5e2e1` / dim `#c4c7c7`, accent purple `#b8a5ff`
- **Fonts** — Bricolage Grotesque (display) + Hanken Grotesk (body / eyebrow labels)
- Tokens live in [`src/app/globals.css`](src/app/globals.css) (`@theme`), consumed as
  Tailwind utilities like `bg-bg`, `text-text-dim`, `border-line`.

## Structure

```
src/
├── app/
│   ├── layout.tsx            # fonts + metadata
│   ├── globals.css           # design tokens
│   ├── page.tsx              # Explore
│   ├── auctions/page.tsx     # listing
│   ├── auctions/[id]/page.tsx# auction detail
│   ├── create/page.tsx       # creator studio
│   └── settlement/page.tsx   # settlement flow
├── components/
│   ├── layout/               # Navbar, Footer
│   ├── ui/                   # Button, Icons
│   ├── explore/              # ArtworkCard
│   └── auction/              # Countdown
└── lib/data.ts               # demo artwork + auction data
public/assets/                # artwork + avatar images exported from Figma
```

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

Assets under `public/assets/` were exported from the Figma source. Demo copy /
prices live in `src/lib/data.ts`.
