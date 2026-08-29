import Image from "next/image"

export function AppSplashScreen({ isExiting }: { isExiting: boolean }) {
  return (
    <main className="app-splash" aria-live="polite" aria-label="Cargando My Muscle App">
      <div className="app-splash__halo" />
      <div className="app-splash__grid" />
      <div className="app-splash__content">
        <div className={isExiting ? "app-splash__logo app-splash__logo--exit" : "app-splash__logo"}>
          <div className="app-splash__logo-ring" />
          <div className="app-splash__logo-mark">
            <Image src="/gym-near-svgrepo-com.svg" alt="" width={76} height={76} priority />
          </div>
        </div>
        <div className={isExiting ? "app-splash__copy app-splash__copy--exit" : "app-splash__copy"}>
          <p className="app-splash__eyebrow">MY MUSCLE APP</p>
          <p className="app-splash__message">Entrando en calor<span className="app-splash__dots">...</span></p>
        </div>
      </div>
    </main>
  )
}
