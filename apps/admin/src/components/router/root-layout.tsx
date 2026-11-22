import { Link, Outlet, useNavigation, useRouteError } from "react-router-dom"

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
    <div className="flex min-h-svh bg-sidebar text-sidebar-foreground">
      <aside aria-hidden="true" className="hidden w-64 shrink-0 flex-col gap-5 px-4 py-5 md:flex">
        <div className="flex h-10 items-center gap-3">
          <div className="size-8 rounded-md bg-sidebar-primary/20" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 rounded bg-sidebar-accent" />
            <div className="h-2 w-28 rounded bg-sidebar-accent" />
          </div>
        </div>
        {["w-16", "w-28", "w-24", "w-32", "w-20", "w-28"].map((width, index) => (
          <div key={index} className={`h-4 rounded bg-sidebar-accent ${width}`} />
        ))}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground md:m-2 md:ml-0 md:rounded-xl">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:px-6">
          <div className="size-8 rounded-md bg-muted" />
          <div className="h-8 w-44 rounded-md bg-muted" />
        </div>
        <main className="grid min-h-48 flex-1 place-items-center px-4 py-5 lg:px-6">
          <div role="status" className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <LoadingSpinner size="sm" inline />
            <span>Loading page…</span>
          </div>
        </main>
      </div>
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
          <Link to="/dashboard" className="rounded-md border px-4 py-2 text-sm">Dashboard</Link>
        </div>
      </div>
    </main>
  )
}
