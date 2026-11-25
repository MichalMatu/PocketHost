import * as React from "react"
import { Link } from "react-router-dom"
import { z } from "zod"
import { Button } from "@/components/ui/button"

const publicationSchema = z.object({
  publication: z.object({
    siteId: z.string().regex(/^site-[a-f0-9]{32}$/).nullable(),
    state: z.enum(["stopped", "starting", "url-assigned", "stopping", "failed", "unknown"]),
    url: z.string().regex(/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.trycloudflare\.com$/).nullable(),
    reason: z.string().max(80).nullable(),
  }).strict().refine(value => (value.state === "url-assigned") === (value.url !== null) &&
    (value.siteId !== null || value.state === "stopped")),
}).strict()

type Publication = z.infer<typeof publicationSchema>["publication"]

/** Both views read the same server-owned session. Opening the disclosure never publishes. */
export function PublicAccessPanel({ siteId, siteName, running = false, disabled = false }: {
  siteId?: string; siteName?: string; running?: boolean; disabled?: boolean
}) {
  const [publication, setPublication] = React.useState<Publication | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [copyMessage, setCopyMessage] = React.useState<string | null>(null)
  const inFlight = React.useRef(false)
  const read = async (action?: "publish-public" | "unpublish-public", target?: string) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    setCopyMessage(null)
    try {
      const response = await fetch("/api/v1/sites/" + (action ? target + "/" + action : "publication"), {
        method: action ? "POST" : "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(action ? 25000 : 10000),
        ...(action ? { headers: { "X-PocketHost-Intent": "public-static" } } : {}),
      })
      if (!response.ok) throw new Error("unavailable")
      const result = publicationSchema.parse(await response.json()).publication
      if (action && result.siteId !== target) throw new Error("mismatched publication")
      setPublication(result)
    } catch {
      setPublication(null)
      setError("Publication state unavailable. Refresh before another action.")
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  const active = publication !== null && !["stopped", "failed"].includes(publication.state)
  const matching = publication !== null && (!siteId || publication.siteId === siteId)
  const url = matching ? publication?.url : null

  return <details className="space-y-3 rounded-md border p-3"
    onToggle={event => { if (event.currentTarget.open) void read() }}>
    <summary className="cursor-pointer text-sm font-medium">Public access · Quick Tunnel</summary>
    <div className="mt-3 space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Temporary HTTPS address, no account required. Intended for demos, not production.
        The address can change when republished. Active release updates are public;
        unpublish before stopping or restarting the site.
      </p>
      {error && <p role="alert" className="text-destructive text-xs">{error}</p>}
      {publication && <p role="status">
        {active && !matching ? "Another site has an active publication." :
          publication.state === "url-assigned" ? "URL assigned · public reachability not verified" :
            publication.state === "starting" ? "Starting · refresh for the address" :
              publication.state === "unknown" ? "Stop unconfirmed · new publication blocked" :
                publication.state === "failed" ? "Publication failed" :
                  publication.state === "stopping" ? "Stopping" : "Not published"}
      </p>}
      {url && <div className="space-y-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className="break-all underline">{url}</a>
        <div><Button size="sm" variant="outline" onClick={() => {
          void navigator.clipboard.writeText(url).then(() => setCopyMessage("Link copied."))
            .catch(() => setCopyMessage("Copy unavailable. Select the address manually."))
        }}>Copy link</Button></div>
        {copyMessage && <p role="status" className="text-xs">{copyMessage}</p>}
      </div>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void read()}>
          Refresh publication
        </Button>
        {siteId && <Button size="sm"
          disabled={busy || disabled || !running || !publication || active}
          onClick={() => {
            if (window.confirm("Publish the active release of " + (siteName ?? "this site") + " to the public Internet?"))
              void read("publish-public", siteId)
          }}>Publish to Internet</Button>}
        {active && matching && publication?.siteId && <Button size="sm" variant="outline"
          disabled={busy || publication.state === "stopping" || publication.state === "unknown"}
          onClick={() => {
            if (publication.siteId) void read("unpublish-public", publication.siteId)
          }}>Unpublish</Button>}
      </div>
      {siteId ? <Link to="/services/cloudflare" className="text-xs underline">Cloudflare settings</Link> :
        <Link to={publication?.siteId ? "/sites?site=" + publication.siteId : "/sites"}
          className="text-xs underline">Manage static websites</Link>}
    </div>
  </details>
}
