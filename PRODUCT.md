# Product

## Register

brand

## Users

Young Mongolian women, on a phone, in the evening. Discovery is
Instagram-adjacent and the mood is browsing rather than shopping: they arrive
without a specific item in mind, scroll, and buy on impulse when something is
cute enough. The device is a mid-range Android on Mongolian mobile data, held
one-handed, often in bed.

The job to be done is "find something that delights me and get it ordered
before the feeling passes." Every second of friction between that feeling and a
confirmed order is the whole risk. They are not comparison shoppers; they will
not come back later to finish an abandoned cart.

## Product Purpose

Sell hotaru's accessories (hair clips, small bags, phone cases, bottles, caps,
pet things) direct to Mongolian shoppers, and give a solo owner a backoffice
that keeps up with orders without a team.

Success is a shopper going from a scroll to a paid order in one sitting, and
the owner never having to touch SQL to run the shop.

Payment is QPay QR or bank transfer, delivery is Ulaanbaatar in 1-2 working
days. Prices are whole tugrik.

## Brand Personality

Cute, soft, playful.

The goods are sweet, and the interface should not fight that. Voice is warm and
plain Mongolian, never corporate and never salesy. No urgency, no manufactured
scarcity, no exclamation-mark marketing. Delight comes from the products and
the photography; the frame stays calm enough to let them speak.

The emotional goal is a small, low-stakes pleasure. Nobody is anxious buying a
hair clip, so the interface should never manufacture anxiety, and should never
make a cheap thing feel like a serious transaction.

## Anti-references

- **Cold Western minimal.** Bloodless Scandinavian e-commerce: grey, sterile,
  all whitespace and no warmth. Technically clean, says nothing about a
  Mongolian shop selling cute things. This is the closest failure mode, because
  restraint executed without warmth lands here by default.
- **AliExpress / Pinduoduo.** Red urgency, countdown timers, discount
  explosions, cluttered density. Makes the goods feel cheap.
- **Instagram-shop chaos.** Screenshot pricing, inconsistent photography,
  emoji-heavy copy, no structure. The thing hotaru is supposed to be an
  upgrade from.

## Design Principles

1. **The product photography is the design.** The catalog is genuinely
   charming; the interface's job is to frame it and get out of the way. Chrome
   that competes with the pictures is chrome that should be deleted.
2. **Warm, not cold.** Restraint is the method, not the mood. Every reduction
   should be checked against the cold-minimal anti-reference: quiet is right,
   clinical is wrong.
3. **The auth wall must be late and light.** Recorded as decision 5 in
   `docs/decisions.md`: an account is required at checkout, which makes that
   wall the most likely drop-off point in the funnel. Everything before it
   should work without an account, and the wall itself should cost as few taps
   as possible.
4. **Answer every tap immediately.** Impulse survives a slow network; it does
   not survive a control that appears not to have registered. Optimistic UI and
   pending states over spinners-after-the-fact.
5. **Thumb-first.** One hand, mid-range Android, evening. If an interaction
   needs two hands or a precise tap, it is broken regardless of how it looks on
   a laptop.

## Accessibility & Inclusion

Sensible defaults rather than a formal audit target: readable contrast, real
focus states, tap targets a thumb can hit, `prefers-reduced-motion` respected
(already implemented in `app/globals.css`), and markup a screen reader can
follow. Mongolian Cyrillic must render correctly at every weight the type scale
uses.
