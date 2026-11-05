export type Lang = 'mn' | 'en'

const CATEGORY_EN: Record<string, string> = {
  gutal: 'Shoes',
  bags: 'Bags',
  cap: 'Hats',
  cups: 'Cups & bottles',
  clothing: 'Clothing',
  accessories: 'Accessories',
  'hair-accessories': 'Hair accessories',
  electronics: 'Phone accessories',
  pet: 'Pets',
}

export function categoryName(slug: string, mn: string, lang: Lang): string {
  return lang === 'en' ? (CATEGORY_EN[slug] ?? mn) : mn
}
