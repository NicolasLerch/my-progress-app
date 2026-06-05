export function formatWeight(weight: number) {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(1)}t`
  }

  return `${weight.toLocaleString()}kg`
}

export function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  })
}
