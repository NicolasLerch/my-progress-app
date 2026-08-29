import Image from "next/image"

export function AppLoadingIndicator({ label = "Cargando...", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div
      className={compact ? "app-loading-indicator app-loading-indicator--compact" : "app-loading-indicator"}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="app-loading-indicator__mark">
        <Image src="/gym-near-svgrepo-com.svg" alt="" width={34} height={34} />
      </div>
    </div>
  )
}
