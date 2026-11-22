import { Link } from "react-router-dom"

export default function NotFoundPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">This address is not a PocketHost management page.</p>
      <Link to="/dashboard" className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Back to dashboard</Link>
    </main>
  )
}
