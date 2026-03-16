/**
 * Склонение существительных по числительному для русского языка.
 * pluralize(1, 'элемент', 'элемента', 'элементов') → 'элемент'
 * pluralize(3, 'элемент', 'элемента', 'элементов') → 'элемента'
 * pluralize(5, 'элемент', 'элемента', 'элементов') → 'элементов'
 */
export function pluralize(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod10 = n % 10
  const mod100 = n % 100

  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
