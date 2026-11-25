import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function NodeOwnerPanel({ trusted, authorized, configured, token, busy, lanView, onToken, onUnlock, onLock }: {
  trusted: boolean; authorized: boolean; configured: boolean | null; token: string; busy: boolean; lanView: boolean
  onToken: (value: string) => void; onUnlock: () => void; onLock: () => void
}) {
  if (trusted) return <p role="status" id="node-owner-access" className="text-muted-foreground text-sm">
    Trusted LAN · Node management enabled without a token.
  </p>
  return <Card id="node-owner-access">
    <CardContent className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Node.js owner access</h2>
        <p role="status" className="text-xs text-muted-foreground">
          Owner: {authorized ? "authenticated" : configured === false ? "host token not configured" : "locked"}.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-52 flex-1 items-center gap-2 text-sm">
          <span className="shrink-0">Owner token</span>
          <Input aria-label="Node owner token" type="password" autoComplete="off" value={token}
            onChange={event => onToken(event.target.value)} />
        </label>
        <Button disabled={busy || token.length < 32} onClick={onUnlock}>Unlock management</Button>
        <Button variant="outline" disabled={!token} onClick={onLock}>Lock</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Token stays in this tab. {lanView ? "LAN HTTP is unencrypted — trusted network only." : "Only use trusted Node code."}
      </p>
    </CardContent>
  </Card>
}
