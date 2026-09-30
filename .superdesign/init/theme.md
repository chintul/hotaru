# Theme — design tokens

## Part 1 — Compact token summary

**Approach:** Tailwind v4. There is **no `tailwind.config`** — tokens are `@theme inline` variables in
`app/globals.css` mapping `--color-*` utilities onto raw `--t-*` values. Utilities are therefore
`bg-paper`, `text-ink-soft`, `border-line`, `bg-primary-strong`, `text-on-primary`, and so on.

**Theming:** `:root` holds light. Dark is declared **twice, identically** — once under
`@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme])`, once under
`:root[data-theme="dark"]`. An inline boot script in `app/layout.js` stamps `data-theme` before first
paint. A `dark` custom variant is declared for Tailwind. **Edit both dark blocks together.**

**Brand:** primary is `#152b57`, a deep ink navy, the same navy as the wordmark. In **light** it clears
AA on every surface (13.50:1 on paper), so `--t-primary` and `--t-primary-strong` are both the brand hex
and text on it is white. In **dark** it is 1.28:1 on the page, so dark lifts the lightness at the same
hue (262) and chroma (0.084). Pure `#000` is banned. Neutrals sit at hue 247, a whisper of chroma
(C 0.003 → 0.016) — cool, deliberately, to agree with the primary.

**Type:** Poppins (`next/font/google`, weights 400/500/600/700) via `--font-poppins` → `--font-sans`.
Body is 14px / 1.6. `.nav-link` = 14px/700 uppercase, 0.7px tracking. `.label` and `.eyebrow` = 12px/600
uppercase. `.display` = 700, -0.4px tracking, callers pass their own `clamp()` size.
`.section-title` = 24px/700 centred.

**Breakpoints:** Tailwind defaults — `sm:640 md:768 lg:1024 xl:1280`. The storefront switches from the
phone layout to the cursor layout at `sm`, and the desktop nav appears at `lg`.

**Touch:** `.icon-btn` is 44px on a phone and 40px from `sm` up. `.tap` and the standalone
`.link-underline` actions hang a 44px hit band off a pseudo-element so small text controls are thumb-sized
without moving layout. `.swatch` keeps a 30px ring inside a 46px target.

### Light tokens (`:root`)

| token | value |
|---|---|
| `--t-paper` | `#fbfcfe` |
| `--t-paper-raise` | `#f4f8fb` |
| `--t-line-soft` | `#ebf0f4` |
| `--t-shade` | `#eef3f8` |
| `--t-line` | `#dde6ef` |
| `--t-line-strong` | `#848d97` |
| `--t-footer` | `#18222b` |
| `--t-ink` | `#1e2a35` |
| `--t-ink-strong` | `#19232d` |
| `--t-ink-soft` | `#57616b` |
| `--t-ink-faint` | `#646f78` |
| `--t-on-ink` | `#ffffff` |
| `--t-primary` | `#152b57` |
| `--t-primary-on` | `#ffffff` |
| `--t-primary-strong` | `#152b57` |
| `--t-on-primary` | `#ffffff` |
| `--t-primary-soft` | `#e6f0ff` |
| `--t-primary-soft-ink` | `#152b57` |
| `--t-sale` | `#be4741` |
| `--t-cream` | `#fdf5e9` |
| `--t-cream-ink` | `#956608` |
| `--t-mint` | `#e9f5ee` |
| `--t-mint-ink` | `#2e7b53` |
| `--t-sky` | `#eaf1fa` |
| `--t-sky-ink` | `#3a6ea8` |
| `--t-blush` | `#fdeef0` |
| `--t-blush-ink` | `#b34a56` |
| `--t-danger` | `#ff5e54` |
| `--t-danger-soft` | `#ffebe8` |
| `--t-danger-line` | `#f9b9b1` |
| `--t-danger-ink` | `#cf2d2a` |
| `--t-success` | `#37a77b` |
| `--t-success-soft` | `#e6f7ee` |
| `--t-success-line` | `#a8d6bf` |
| `--t-success-ink` | `#007f57` |
| `--t-warn` | `#db7d24` |
| `--t-warn-soft` | `#ffefe1` |
| `--t-warn-line` | `#f0c19f` |
| `--t-warn-ink` | `#ad5700` |
| `--t-info` | `#5493ff` |
| `--t-info-soft` | `#e8f3ff` |
| `--t-info-line` | `#b1cbfd` |
| `--t-info-ink` | `#2d67e2` |
| `--t-note` | `#ac7aff` |
| `--t-note-soft` | `#f3efff` |
| `--t-note-line` | `#cdc3f9` |
| `--t-note-ink` | `#804beb` |
| `--t-a-bg` | `#f7f7f8` |
| `--t-a-surface` | `#ffffff` |
| `--t-a-ink` | `#18181b` |
| `--t-a-on-ink` | `#ffffff` |
| `--t-a-muted` | `#6e6e74` |
| `--t-a-line` | `#e4e4e7` |
| `--t-a-hover` | `#f4f4f5` |
| `--t-a-focus` | `#3472d9` |
| `--t-lift` | `0 8px 22px -14px rgb(23 35 46 / .45)` |

### Dark tokens (`:root[data-theme="dark"]`, and the identical `prefers-color-scheme` block)

| token | value |
|---|---|
| `--t-paper` | `#13191f` |
| `--t-paper-raise` | `#1d242b` |
| `--t-line-soft` | `#272f37` |
| `--t-shade` | `#242c33` |
| `--t-line` | `#37424c` |
| `--t-line-strong` | `#6a757f` |
| `--t-footer` | `#090f15` |
| `--t-ink` | `#e3eef8` |
| `--t-ink-strong` | `#f2f6fb` |
| `--t-ink-soft` | `#98a5b1` |
| `--t-ink-faint` | `#8895a1` |
| `--t-on-ink` | `#0c1218` |
| `--t-primary` | `#617cae` |
| `--t-primary-on` | `#0a1016` |
| `--t-primary-strong` | `#7e9bcf` |
| `--t-on-primary` | `#0a1016` |
| `--t-primary-soft` | `#152b57` |
| `--t-primary-soft-ink` | `#7a96ca` |
| `--t-sale` | `#dd766c` |
| `--t-cream` | `#3a2b12` |
| `--t-cream-ink` | `#c09657` |
| `--t-mint` | `#1a3427` |
| `--t-mint-ink` | `#70af8a` |
| `--t-sky` | `#1f2f43` |
| `--t-sky-ink` | `#74a2d6` |
| `--t-blush` | `#412429` |
| `--t-blush-ink` | `#db8288` |
| `--t-danger` | `#c13a33` |
| `--t-danger-soft` | `#42231f` |
| `--t-danger-line` | `#633934` |
| `--t-danger-ink` | `#df756a` |
| `--t-success` | `#1b7a57` |
| `--t-success-soft` | `#193327` |
| `--t-success-line` | `#274e3c` |
| `--t-success-ink` | `#69a88b` |
| `--t-warn` | `#a25805` |
| `--t-warn-soft` | `#3e2613` |
| `--t-warn-line` | `#5e3d23` |
| `--t-warn-ink` | `#c58959` |
| `--t-info` | `#3466cf` |
| `--t-info-soft` | `#202c45` |
| `--t-info-line` | `#344566` |
| `--t-info-ink` | `#6c96ea` |
| `--t-note` | `#7950d7` |
| `--t-note-soft` | `#2d2842` |
| `--t-note-line` | `#474063` |
| `--t-note-ink` | `#9d83ed` |
| `--t-a-bg` | `#171719` |
| `--t-a-surface` | `#212123` |
| `--t-a-ink` | `#e7e7ea` |
| `--t-a-on-ink` | `#171719` |
| `--t-a-muted` | `#939398` |
| `--t-a-line` | `#39393c` |
| `--t-a-hover` | `#2b2b2e` |
| `--t-a-focus` | `#5a8ad8` |
| `--t-lift` | `0 8px 22px -12px rgb(0 0 0 / .6)` |

## Part 2 — Raw source

### `app/globals.css`

```css
@import "tailwindcss";

@custom-variant dark {
  @media (prefers-color-scheme: dark) {
    &:where(:root:not([data-theme]), :root:not([data-theme]) *) { @slot }
  }
  &:where([data-theme="dark"], [data-theme="dark"] *) { @slot }
}

@theme inline {
  --color-paper:       var(--t-paper);        /* the page */
  --color-paper-raise: var(--t-paper-raise);  /* cards, cart thumbs, order panels */
  --color-line-soft:   var(--t-line-soft);    /* hover grounds, skeleton base */
  --color-shade:       var(--t-shade);        /* product image backdrop */
  --color-line:        var(--t-line);         /* decorative hairline */
  --color-line-strong: var(--t-line-strong);  /* real component boundaries */
  --color-footer:      var(--t-footer);

  /* Storefront text. */
  --color-ink:         var(--t-ink);
  --color-ink-strong:  var(--t-ink-strong);
  --color-ink-soft:    var(--t-ink-soft);
  --color-ink-faint:   var(--t-ink-faint);
  --color-on-ink:      var(--t-on-ink);       /* text on an ink-strong fill */

  /* Primary. #152b57 is the brand hex. Light uses it as-is; dark lifts the
     lightness (same hue and chroma) because it is 1.28:1 on a dark ground. */
  --color-primary:          var(--t-primary);
  --color-primary-on:       var(--t-primary-on);
  --color-primary-strong:   var(--t-primary-strong);
  --color-on-primary:       var(--t-on-primary);
  --color-primary-soft:     var(--t-primary-soft);
  --color-primary-soft-ink: var(--t-primary-soft-ink);

  --color-sale: var(--t-sale);

  /* Order-state tints. */
  --color-cream:     var(--t-cream);     --color-cream-ink: var(--t-cream-ink);
  --color-mint:      var(--t-mint);      --color-mint-ink:  var(--t-mint-ink);
  --color-sky:       var(--t-sky);       --color-sky-ink:   var(--t-sky-ink);
  --color-blush:     var(--t-blush);     --color-blush-ink: var(--t-blush-ink);

  /* Feedback: admin banners, form errors, "saved" ticks, status dots. */
  --color-danger:  var(--t-danger);  --color-danger-soft:  var(--t-danger-soft);
  --color-danger-line: var(--t-danger-line); --color-danger-ink: var(--t-danger-ink);
  --color-success: var(--t-success); --color-success-soft: var(--t-success-soft);
  --color-success-line: var(--t-success-line); --color-success-ink: var(--t-success-ink);
  --color-warn:    var(--t-warn);    --color-warn-soft:    var(--t-warn-soft);
  --color-warn-line: var(--t-warn-line); --color-warn-ink: var(--t-warn-ink);
  --color-info:    var(--t-info);    --color-info-soft:    var(--t-info-soft);
  --color-info-line: var(--t-info-line); --color-info-ink: var(--t-info-ink);
  --color-note:    var(--t-note);    --color-note-soft:    var(--t-note-soft);
  --color-note-line: var(--t-note-line); --color-note-ink: var(--t-note-ink);

  --color-a-bg:      var(--t-a-bg);
  --color-a-surface: var(--t-a-surface);
  --color-a-ink:     var(--t-a-ink);
  --color-a-on-ink:  var(--t-a-on-ink);   /* text on a bg-a-ink fill */
  --color-a-muted:   var(--t-a-muted);
  --color-a-line:    var(--t-a-line);
  --color-a-hover:   var(--t-a-hover);
  --color-a-focus:   var(--t-a-focus);
}

@theme {
  --font-sans: var(--font-poppins), ui-sans-serif, system-ui, sans-serif;
}

/* ---------------------------------------------------------------------------
   LIGHT — a cool spine.

   A warm-tinted neutral under a cool primary reads as an accident rather than
   as a decision — the two tints fight at every border. So the neutrals carry a
   cool hue (OKLCH h = 247) at a whisper of chroma: C runs 0.003 (paper) ->
   0.016 (line). The primary sits at h = 262; 15deg apart is invisible at this
   chroma, so re-hueing the neutrals to match would move no pixel a shopper can
   see and would invalidate every ratio documented below.

   PRODUCT.md names cold Western minimal as the closest failure mode, and a
   cool grey is how you land there. The defence is that the tint is a real hue,
   not an absence of one, and that #152b57 is a deep ink navy rather than a
   screen blue — but this is the palette's main risk and worth re-reading
   PRODUCT.md before pushing it further in this direction.

   Every ratio below was solved, not eyeballed: each text role is pinned against
   the DARKEST surface it can land on (--shade, not --paper), because a value
   that clears 4.5:1 on the page ground can still fail on a card. That is the
   bug the old --color-ink-faint had: 4.75:1 on paper, 4.26:1 on shade.
--------------------------------------------------------------------------- */
:root {
  color-scheme: light;

  --t-paper:       #fbfcfe;
  --t-paper-raise: #f4f8fb;
  --t-line-soft:   #ebf0f4;
  --t-shade:       #eef3f8;
  --t-line:        #dde6ef;   /* 1.23:1 on paper — decorative hairline only */
  --t-line-strong: #848d97;   /* 3.28:1 on paper, 3.02:1 on shade — input borders */
  --t-footer:      #18222b;

  --t-ink:         #1e2a35;   /* 14.23 paper · 13.68 raise · 13.08 shade */
  --t-ink-strong:  #19232d;   /* 15.50 paper · 14.25 shade */
  --t-ink-soft:    #57616b;   /*  6.15 paper ·  5.65 shade */
  --t-ink-faint:   #646f78;   /*  5.01 paper ·  4.60 shade — clears AA on BOTH */
  --t-on-ink:      #ffffff;   /* 15.91 on ink-strong */

  /* #152b57 clears AA on every light surface, so here the brand hex IS the
     strong one and both tokens hold it — only dark has to lift it. */
  --t-primary:          #152b57;   /* 13.50 paper · 12.98 raise · 12.42 shade */
  --t-primary-on:       #ffffff;   /* 13.86:1 on the #152b57 fill */
  --t-primary-strong:   #152b57;   /* text, rings, buttons */
  --t-on-primary:       #ffffff;   /* 13.86:1 on primary-strong */
  --t-primary-soft:     #e6f0ff;
  --t-primary-soft-ink: #152b57;   /* 12.06:1 on primary-soft */

  --t-sale: #be4741;   /* 4.91 paper · 4.51 shade */

  --t-cream: #fdf5e9;  --t-cream-ink: #956608;  /* 4.64:1 */
  --t-mint:  #e9f5ee;  --t-mint-ink:  #2e7b53;  /* 4.60:1 */
  --t-sky:   #eaf1fa;  --t-sky-ink:   #3a6ea8;  /* 4.64:1 */
  --t-blush: #fdeef0;  --t-blush-ink: #b34a56;  /* 4.63:1 */

  /* Each -ink clears 4.5:1 on its own -soft and on all six page grounds. */
  --t-danger:  #ff5e54; --t-danger-soft:  #ffebe8; --t-danger-line:  #f9b9b1; --t-danger-ink:  #cf2d2a;
  --t-success: #37a77b; --t-success-soft: #e6f7ee; --t-success-line: #a8d6bf; --t-success-ink: #007f57;
  --t-warn:    #db7d24; --t-warn-soft:    #ffefe1; --t-warn-line:    #f0c19f; --t-warn-ink:    #ad5700;
  --t-info:    #5493ff; --t-info-soft:    #e8f3ff; --t-info-line:    #b1cbfd; --t-info-ink:    #2d67e2;
  --t-note:    #ac7aff; --t-note-soft:    #f3efff; --t-note-line:    #cdc3f9; --t-note-ink:    #804beb;

  --t-a-bg:      #f7f7f8;
  --t-a-surface: #ffffff;
  --t-a-ink:     #18181b;
  --t-a-on-ink:  #ffffff;   /* 17.72:1 on a-ink */
  --t-a-muted:   #6e6e74;   /* 4.73 bg · 5.07 surface · 4.61 hover */
  --t-a-line:    #e4e4e7;
  --t-a-hover:   #f4f4f5;
  --t-a-focus:   #3472d9;   /* 4.61:1 on a-surface */

  /* Tokenised: a black shadow is invisible on a dark ground. */
  --t-lift: 0 8px 22px -14px rgb(23 35 46 / .45);
}

/* The two dark blocks carry identical declarations — plain CSS cannot share
   them. Edit both. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    color-scheme: dark;

    --t-paper:       #13191f;
    --t-paper-raise: #1d242b;
    --t-line-soft:   #272f37;
    --t-shade:       #242c33;
    --t-line:        #37424c;
    --t-line-strong: #6a757f;
    --t-footer:      #090f15;

    --t-ink:         #e3eef8;
    --t-ink-strong:  #f2f6fb;
    --t-ink-soft:    #98a5b1;
    --t-ink-faint:   #8895a1;
    --t-on-ink:      #0c1218;

    --t-primary:          #617cae;
    --t-primary-on:       #0a1016;
    --t-primary-strong:   #7e9bcf;
    --t-on-primary:       #0a1016;
    --t-primary-soft:     #152b57;
    --t-primary-soft-ink: #7a96ca;

    --t-sale: #dd766c;

    --t-cream: #3a2b12;  --t-cream-ink: #c09657;
    --t-mint:  #1a3427;  --t-mint-ink:  #70af8a;
    --t-sky:   #1f2f43;  --t-sky-ink:   #74a2d6;
    --t-blush: #412429;  --t-blush-ink: #db8288;

    --t-danger:  #c13a33; --t-danger-soft:  #42231f; --t-danger-line:  #633934; --t-danger-ink:  #df756a;
    --t-success: #1b7a57; --t-success-soft: #193327; --t-success-line: #274e3c; --t-success-ink: #69a88b;
    --t-warn:    #a25805; --t-warn-soft:    #3e2613; --t-warn-line:    #5e3d23; --t-warn-ink:    #c58959;
    --t-info:    #3466cf; --t-info-soft:    #202c45; --t-info-line:    #344566; --t-info-ink:    #6c96ea;
    --t-note:    #7950d7; --t-note-soft:    #2d2842; --t-note-line:    #474063; --t-note-ink:    #9d83ed;

    --t-a-bg:      #171719;
    --t-a-surface: #212123;
    --t-a-ink:     #e7e7ea;
    --t-a-on-ink:  #171719;
    --t-a-muted:   #939398;
    --t-a-line:    #39393c;
    --t-a-hover:   #2b2b2e;
    --t-a-focus:   #5a8ad8;

    --t-lift: 0 8px 22px -12px rgb(0 0 0 / .6);
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;

  --t-paper:       #13191f;
  --t-paper-raise: #1d242b;
  --t-line-soft:   #272f37;
  --t-shade:       #242c33;
  --t-line:        #37424c;
  --t-line-strong: #6a757f;   /* 3.76 paper · 3.01 shade */
  --t-footer:      #090f15;

  --t-ink:         #e3eef8;   /* 15.05 paper · 13.33 raise · 12.04 shade */
  --t-ink-strong:  #f2f6fb;   /* 16.31 paper · 13.05 shade */
  --t-ink-soft:    #98a5b1;   /*  7.04 paper ·  5.63 shade */
  --t-ink-faint:   #8895a1;   /*  5.78 paper ·  4.63 shade */
  --t-on-ink:      #0c1218;   /* 17.35 on ink-strong */

  /* #152b57 is 1.28:1 on this paper, so dark lifts it: same hue (262) and the
     same chroma, more lightness. The brand hex stays, as the soft tint. */
  --t-primary:          #617cae;   /* 4.22 paper · 3.37 shade — carries a boundary */
  --t-primary-on:       #0a1016;   /* 4.55:1 on the fill */
  --t-primary-strong:   #7e9bcf;   /* 6.30 paper · 5.04 shade */
  --t-on-primary:       #0a1016;   /* 6.81:1 on primary-strong */
  --t-primary-soft:     #152b57;
  --t-primary-soft-ink: #7a96ca;   /* 4.65:1 on primary-soft */

  --t-sale: #dd766c;   /* 5.80 paper · 4.64 shade */

  --t-cream: #3a2b12;  --t-cream-ink: #c09657;  /* 5.05:1 */
  --t-mint:  #1a3427;  --t-mint-ink:  #70af8a;  /* 5.23:1 */
  --t-sky:   #1f2f43;  --t-sky-ink:   #74a2d6;  /* 5.10:1 */
  --t-blush: #412429;  --t-blush-ink: #db8288;  /* 5.01:1 */

  --t-danger:  #c13a33; --t-danger-soft:  #42231f; --t-danger-line:  #633934; --t-danger-ink:  #df756a;
  --t-success: #1b7a57; --t-success-soft: #193327; --t-success-line: #274e3c; --t-success-ink: #69a88b;
  --t-warn:    #a25805; --t-warn-soft:    #3e2613; --t-warn-line:    #5e3d23; --t-warn-ink:    #c58959;
  --t-info:    #3466cf; --t-info-soft:    #202c45; --t-info-line:    #344566; --t-info-ink:    #6c96ea;
  --t-note:    #7950d7; --t-note-soft:    #2d2842; --t-note-line:    #474063; --t-note-ink:    #9d83ed;

  --t-a-bg:      #171719;
  --t-a-surface: #212123;
  --t-a-ink:     #e7e7ea;
  --t-a-on-ink:  #171719;   /* 14.51:1 on a-ink */
  --t-a-muted:   #939398;   /* 5.85 bg · 5.26 surface · 4.62 hover */
  --t-a-line:    #39393c;
  --t-a-hover:   #2b2b2e;
  --t-a-focus:   #5a8ad8;

  --t-lift: 0 8px 22px -12px rgb(0 0 0 / .6);
}

html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

body {
  background: var(--color-paper);
  color: var(--color-ink);
  font-size: 14px;
  line-height: 1.6;
}

@layer components {
  /* Primary nav + anything that reads as a control label. */
  .nav-link {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    color: var(--color-ink-strong);
  }

  /* Centred section headings: "BEST SELLING" with a small underlined View All. */
  .section-title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-align: center;
  }

  /* Page-title face. Callers pass their own clamp() size; this only carries the
     weight and tracking so every large heading agrees. It was being used by
     /orders, /wishlist and the 404 before it existed, which left those titles
     at the body weight — heavier than intended is the bug, not the fix. */
  .display {
    font-weight: 700;
    letter-spacing: -0.4px;
    line-height: 1.12;
  }

  /* Small uppercase label. Kept as a utility because checkout, account and admin
     surfaces lean on it heavily; the storefront chrome uses .nav-link instead. */
  .label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .eyebrow {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  /* Announcement marquee. Duplicated track so the loop has no visible seam. */
  @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
  .marquee-track {
    display: flex;
    width: max-content;
    animation: marquee 40s linear infinite;
  }
  .marquee-track:hover { animation-play-state: paused; }

  /* Card image cross-fade on hover.
     Both states live here on purpose. The resting `opacity: 0` used to be an
     `opacity-0` utility on the element, but a utility beats this components
     layer, so the :hover rule below could never raise it. Dropping the utility
     without restoring the rule here left the preview permanently opaque on top
     of the primary image — the card showed the second photo at rest and hover
     appeared to do nothing. Keep the pair together. */
  /* Was transform 1s. A hover that takes a full second to settle reads as lag
     rather than as polish — the pointer has usually left before it arrives. */
  .card-media img, .card-media .ph { transition: opacity var(--dur-slow) ease, transform .5s var(--ease); }
  .card-media .media-hover { opacity: 0; }
  /* Guarded by (hover: hover). A tap on a touch screen can latch :hover, and
     the preview image is no longer rendered there — so unguarded, the rule
     below would fade the only picture out and leave the card blank until the
     next tap elsewhere. */
  @media (hover: hover) {
    .card-media:hover .media-hover { opacity: 1; }
    .card-media:hover .media-primary { opacity: 0; }
    .card-media:hover img, .card-media:hover .ph { transform: scale(1.03); }
  }

  /* Variant name pill sitting over the image, with its little circular knob. */
  .badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 14px 4px 4px;
    border-radius: 999px;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
  }
  .badge-knob {
    width: 22px; height: 22px; border-radius: 999px;
    background: rgba(255,255,255,.35);
    display: grid; place-items: center;
    font-size: 10px;
  }

  /* Colour swatch circles under a card and on the PDP. */
  .swatch {
    position: relative;
    width: 30px; height: 30px; border-radius: 999px;
    border: 1px solid var(--color-line);
    display: grid; place-items: center;
    transition: box-shadow var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
  }
  /* A 30px circle is a 30px target. The ring stays 30px and the thumb gets 44,
     taken from the gap around it rather than from the layout. */
  .swatch::after {
    content: ''; position: absolute; inset: -8px; border-radius: 999px;
  }
  .swatch:hover { transform: scale(1.06); }
  /* --primary-strong, so the ring is right in both themes: dark lifts it. */
  .swatch[data-active="true"] {
    border-color: var(--color-primary-strong);
    box-shadow: 0 0 0 1px var(--color-primary-strong);
    transform: scale(1.06);
  }

  /* 44px on a phone, 40 where there is a cursor. This is the chrome every page
     is operated by, one-handed. */
  .icon-btn {
    width: 44px; height: 44px; border-radius: 999px;
    display: grid; place-items: center;
    transition: background-color .15s ease;
  }
  @media (min-width: 640px) { .icon-btn { width: 40px; height: 40px; } }
  .icon-btn:hover { background: var(--color-line-soft); }

  /* Gives a small control a 44px touch area without moving anything around it.
     For controls that are text-sized by design — breadcrumbs, "share", the
     standalone underlined actions.

     Scoped to .inline-block/.block for the underlined links on purpose: those
     sit on their own line. The same treatment on a link inside a sentence
     would put a 44px band over the lines above and below it and swallow taps
     meant for them. */
  .tap,
  .link-underline:is(.inline-block, .block) { position: relative; }
  .tap::after,
  .link-underline:is(.inline-block, .block)::after {
    content: ''; position: absolute; left: 0; right: 0;
    top: 50%; translate: 0 -50%;
    height: 100%; min-height: 44px;
  }

  /* Both icons are in the DOM; CSS shows the one you would switch TO. Keyed on
     the attribute rather than React state so it is right on the first paint.
     Same grid cell, so the button does not resize on swap. */
  .theme-icon { grid-area: 1 / 1; }
  .theme-icon-sun { display: none; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme]) .theme-icon-sun { display: block; }
    :root:not([data-theme]) .theme-icon-moon { display: none; }
  }
  [data-theme="dark"] .theme-icon-sun { display: block; }
  [data-theme="dark"] .theme-icon-moon { display: none; }

  /* Wordmark swap, same mechanism as the icons above. */
  .logo-dark { display: none; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme]) .logo-light { display: none; }
    :root:not([data-theme]) .logo-dark { display: block; }
  }
  [data-theme="dark"] .logo-light { display: none; }
  [data-theme="dark"] .logo-dark { display: block; }

  /* 14px/700 uppercase is not "large text" to WCAG (that starts at 18.66px
     bold), so these labels need the full 4.5:1: --on-primary on
     --primary-strong is 13.86:1 in light and 6.81:1 in dark. Hover is an
     opacity step so it needs no second token and works in both themes. */
  .btn-solid {
    background: var(--color-primary-strong);
    color: var(--color-on-primary);
    font-weight: 700;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    font-size: 14px;
    transition: opacity .15s ease;
  }
  .btn-solid:hover { opacity: .85; }
  .btn-solid:disabled { opacity: .35; cursor: not-allowed; }

  .btn-outline {
    border: 1px solid var(--color-primary-strong);
    color: var(--color-primary-strong);
    font-weight: 700;
    letter-spacing: .7px;
    text-transform: uppercase;
    font-size: 13px;
    transition: background-color .15s ease, color .15s ease;
  }
  .btn-outline:hover { background: var(--color-primary-strong); color: var(--color-on-primary); }

  .link-underline { text-decoration: underline; text-underline-offset: 4px; }

  /* Auth screens: larger, rounded fields with a 2px focus ring, matching the
     reference's hosted sign-in. */
  /* --line-strong, not --line: WCAG 1.4.11 asks 3:1 of a control boundary, and
     here the border IS the only cue that the box is typeable. */
  .auth-input {
    width: 100%;
    border-radius: 8px;
    border: 2px solid var(--color-line-strong);
    background: var(--color-paper);
    color: var(--color-ink);
    padding: 14px 16px;
    font-size: 14px;
    outline: none;
    transition: border-color .15s ease;
  }
  .auth-input:focus { border-color: var(--color-primary-strong); }
  .auth-input::placeholder { color: var(--color-ink-faint); }

  .secondary-action {
    width: 100%;
    border-radius: 999px;
    border: 1px solid var(--color-line-strong);
    padding: 14px 0;
    font-size: 14px;
    font-weight: 500;
    transition: border-color .15s ease, color .15s ease;
  }
  .secondary-action:hover { border-color: var(--color-primary-strong); color: var(--color-primary-strong); }
}

/* ---------------------------------------------------------------------------
   Motion tokens.

   The curve is not new: cubic-bezier(.22,1,.36,1) is ease-out-quint, and it was
   already what fade-up, drawer-in and o-modal-in used. Naming it stops the
   fourth animation inventing a fifth curve. Durations are a three-step scale —
   anything outside it is a decision worth arguing about, not a default.

   Everything here is disarmed by the prefers-reduced-motion block below.
--------------------------------------------------------------------------- */
:root {
  --ease: cubic-bezier(.22, 1, .36, 1);
  --dur-fast: .16s;   /* state flips: press, ring, tick */
  --dur: .28s;        /* entrances, crossfades */
  --dur-slow: .45s;   /* image work, anything large */
}

@keyframes fade-up { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
.fade-up { animation: fade-up var(--dur-slow) var(--ease) both; }

/* Stagger a list without a wrapper per item: the caller sets --i on each child
   and the delay falls out of it. Capped at 8 so a 40-item grid does not leave
   the last card waiting two seconds to appear. */
.stagger > * { animation: fade-up var(--dur) var(--ease) both; animation-delay: calc(min(var(--i, 0), 8) * 40ms); }
@keyframes overlay-in { from { opacity: 0 } to { opacity: 1 } }
.overlay-in { animation: overlay-in .2s ease both; }
/* Same keyframe, different job: a picture replacing another picture. Named
   separately so changing the overlay timing later does not silently retime
   every product image on the site. */
.fade-in { animation: overlay-in var(--dur) var(--ease) both; }
@keyframes sheet-in { from { transform: translateY(100%) } to { transform: none } }
.sheet-in { animation: sheet-in .3s var(--ease) both; }
@keyframes drawer-in { from { transform: translateX(100%) } to { transform: none } }
.drawer-in { animation: drawer-in .35s var(--ease) both; }

/* The add-to-cart button's three states. `pop` is reused by the header count
   badge, so a successful add reads as one gesture across two places. */
@keyframes tick-in { from { opacity: 0; transform: scale(.4) } to { opacity: 1; transform: none } }
.tick-in { animation: tick-in var(--dur) var(--ease) both; }
@keyframes count-pop { 0% { transform: scale(1) } 40% { transform: scale(1.35) } 100% { transform: scale(1) } }
.count-pop { animation: count-pop .34s var(--ease); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  /* The blanket rule does not stop an infinite animation, it fast-forwards it:
     the marquee track snaps to -50% and the reader is left looking at the
     second copy of the list, and a loop at .01ms is a repaint every frame for
     as long as the element lives. Every infinite animation in this file has to
     be turned OFF, not sped up — there are three, and the exemption used to
     name only the first.
     .o-skeleton keeps a flat ground so a loading block still reads as a block,
     and .o-ping keeps its dot visible rather than mid-expansion. */
  .marquee-track { animation: none !important; transform: none !important; }
  .o-skeleton { animation: none !important; background: var(--color-line-soft) !important; }
  .o-ping { animation: none !important; opacity: .55 !important; transform: none !important; }
}

/* One visible focus ring for the whole storefront. Before this the only
   :focus-visible rule in the codebase was on order pages, so every shop
   control fell back to the UA default and three inputs removed it outright. */
/* --primary-strong, not the brand hex: 6.59:1 on light paper and 6.53:1 on
   dark, so one token rings correctly in both themes. */
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--color-primary-strong);
  outline-offset: 2px;
  border-radius: 2px;
}

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }

::selection { background: var(--color-primary-strong); color: var(--color-on-primary); }

/* ---------------------------------------------------------------------------
   Order screens.

   Deliberately a second vocabulary rather than a change to the one above. The
   catalog is stark on purpose (hard 1px borders, zero radius); an order page is
   read once, under stress, usually on a phone, and wants the opposite: soft
   edges, warm ground, and colour that says at a glance which state the order is
   in. Everything here is prefixed or order-specific so nothing leaks into the
   shop.
--------------------------------------------------------------------------- */
@layer components {
  /* The one card shape these pages use. */
  .o-card {
    border: 1px solid var(--color-line);
    border-radius: 20px;
    background: var(--color-paper);
  }
  .o-card-warm { background: var(--color-paper-warm); }

  /* Rounded pill carrying an order/payment state. Colour comes from a
     data-tone attribute so the caller maps status -> tone in one place. */
  .o-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: .3px;
    background: var(--color-shade);
    color: var(--color-ink-soft);
  }
  .o-chip[data-tone="wait"]  { background: var(--color-cream); color: var(--color-cream-ink); }
  .o-chip[data-tone="good"]  { background: var(--color-mint);  color: var(--color-mint-ink); }
  .o-chip[data-tone="move"]  { background: var(--color-sky);   color: var(--color-sky-ink); }
  .o-chip[data-tone="stop"]  { background: var(--color-blush); color: var(--color-blush-ink); }

  /* A choice card: QPay vs bank transfer, and the segmented switch inside the
     modal. Hover lifts a little so it reads as pressable on desktop; the ring
     on [data-active] is what marks the current choice. */
  .o-pick {
    border: 1px solid var(--color-line);
    border-radius: 18px;
    background: var(--color-paper);
    padding: 18px;
    text-align: left;
    transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
  }
  .o-pick:hover { border-color: var(--color-primary-strong); transform: translateY(-2px); box-shadow: var(--t-lift); }
  .o-pick[data-active="true"] { border-color: var(--color-primary-strong); box-shadow: 0 0 0 1px var(--color-primary-strong); }
  .o-pick:focus-visible { outline: 2px solid var(--color-primary-strong); outline-offset: 2px; }

  /* Loading placeholder. A sweep rather than a pulse, because the skeleton
     mirrors the real layout and a pulse on eight blocks at once flickers. */
  .o-skeleton {
    border-radius: 12px;
    background: linear-gradient(90deg, var(--color-line-soft) 25%, var(--color-shade) 37%, var(--color-line-soft) 63%);
    background-size: 400% 100%;
    animation: o-sweep 1.4s ease infinite;
  }
}

@keyframes o-sweep { from { background-position: 100% 50% } to { background-position: 0 50% } }

/* The waiting-for-payment dot on the trail and in the modal. */
@keyframes o-ping { 0% { transform: scale(1); opacity: .55 } 70%, 100% { transform: scale(2.1); opacity: 0 } }
.o-ping { animation: o-ping 1.8s cubic-bezier(0,0,.2,1) infinite; }

/* Modal: rises from slightly below and small, so dismissing feels reversible. */
@keyframes o-modal-in { from { opacity: 0; transform: translateY(14px) scale(.97) } to { opacity: 1; transform: none } }
.o-modal-in { animation: o-modal-in .28s cubic-bezier(.22,1,.36,1) both; }

/* Payment confirmed. One overshoot, then settle — the single celebratory
   moment on the page, and only ever fired once per order. */
@keyframes o-pop { 0% { opacity: 0; transform: scale(.6) } 60% { opacity: 1; transform: scale(1.08) } 100% { transform: scale(1) } }
.o-pop { animation: o-pop .5s cubic-bezier(.22,1,.36,1) both; }
```

### Tailwind config

None. Tailwind v4 is configured entirely through `@theme` / `@theme inline` in `app/globals.css`,
loaded via `@tailwindcss/postcss`.

### Theme provider

See `components/ThemeProvider.jsx` and `lib/theme.js` in `layouts.md`; `lib/theme.js` holds
`THEME_KEY`, `PREFERENCES` and `THEME_COLOR` and is deliberately **not** a `'use client'` module so the
server-rendered boot script can read the same constants.
