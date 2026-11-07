/** Remove a duplicated ingredient name from its amount, matching the H5 table. */
export function trimName(name: string, amount: string) {
  const match = amount.match(/^([^\s:：\d]+)[\s:：]+(.+)$/)
  if (!match) return amount
  const base = name.replace(/[（(][^）)]*[）)]/g, '')
  return base.includes(match[1]) || match[1].includes(base) ? match[2] : amount
}
