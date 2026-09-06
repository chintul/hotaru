/**
 * Title → URL slug, for the admin product form.
 *
 * Mongolian Cyrillic has no useful Unicode normalisation path to ASCII, so the
 * mapping is explicit. It follows MNS 5217:2012 romanisation loosely — the goal
 * is a readable, stable, typeable slug, not a reversible transliteration.
 *
 * Note ө and ү both land on 'u'. That can collide (өнгө / унга), which is fine:
 * the slug field stays editable and the database has a unique constraint on it.
 */
const CYRILLIC = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
  и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', ө: 'u', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ү: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch',
  ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function slugify(text) {
  if (!text) return ''

  let out = ''
  for (const ch of String(text).toLowerCase()) {
    out += Object.hasOwn(CYRILLIC, ch) ? CYRILLIC[ch] : ch
  }

  return out
    // Strip Latin diacritics: café → cafe.
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
