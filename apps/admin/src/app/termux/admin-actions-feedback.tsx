/** Shared read-only status and error feedback for Termux action panels. */
export function Feedback({ error, done }: { error: string | null; done: string | null }) {
  return <>{error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {done && <p role="status" className="text-sm">{done}</p>}</>
}
