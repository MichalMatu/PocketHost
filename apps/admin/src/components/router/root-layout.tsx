import { Outlet, useNavigation, useRouteError } from "react-router-dom"

import { LoadingSpinner } from "@/components/ui/loading-spinner"

/** Thin top bar shown while the next route's code is loading. */
function RouteProgress() {
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="route-progress fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/15"
    >
      <div className="route-progress-bar h-full w-1/3 bg-primary" />
    </div>
  )
}

export function RootLayout() {
  const navigation = useNavigation()
  return (
    <>
      {navigation.state === "loading" && <RouteProgress />}
      <Outlet />
    </>
  )
}

/** Shown on the very first load, before any route has rendered. */
export function RootFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <LoadingSpinner />
    </div>
  )
}

/** A failed or stalled Vite module must not leave the browser on a spinner. */
export function RouteLoadError() {
  useRouteError()
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 text-foreground">
      <div role="alert" className="w-full max-w-md space-y-3 rounded-md border bg-card p-6">
        <h1 className="text-lg font-semibold">Page could not be loaded</h1>
        <p className="text-sm text-muted-foreground">
          The PocketHost DEV interface did not finish loading this page.
          Existing hosted services are not automatically affected.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="rounded-md border px-4 py-2 text-sm"
            onClick={() => window.location.reload()}>Retry page</button>
          <a href="/dashboard" className="rounded-md border px-4 py-2 text-sm">Dashboard</a>
        </div>
      </div>
    </main>
  )
}
