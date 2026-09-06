/**
 * Which variant uses which photograph.
 *
 * Kept free of React so `node --test` can reach it: this repo has no DOM test
 * harness, so every rule that can live here instead of inside a component does.
 *
 * The rule these encode: `variants.image_id` decides the card and hover photos
 * whenever ANY variant carries one (ProductCard.jsx:35 and :41-49). Position
 * decides them only when none does — which is why `ImagesTab.jsx:145`'s
 * `карт / hover / 2 / 3` labels were wrong the moment a variant got a picture.
 */

/** optionValue is nullable, and a product may have one unnamed variant. */
export function variantLabel(variant) {
  return variant?.optionValue || variant?.sku || 'Нэргүй сонголт'
}

export function linkage(variants = []) {
  const usage = {}
  for (const v of variants) {
    const id = v?.image?.id
    if (!id) continue
    if (!usage[id]) usage[id] = []
    usage[id].push(variantLabel(v))
  }
  // An image with no entry in `usage` is a gallery shot. There is no separate
  // list of them: the strip renders every image and labels it from this map.
  return { usage, positionStillRules: Object.keys(usage).length === 0 }
}

/** Labels of the variants that would be left photoless by deleting this image. */
export function orphansOf(imageId, variants = []) {
  return variants.filter((v) => v?.image?.id === imageId).map(variantLabel)
}
