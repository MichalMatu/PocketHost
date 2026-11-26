import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { endpoint, inspect } from "./admin-actions-api"

type CommandResponse = { operation: string; result: { exit: number; output: string } }

type PackageEcosystem = "termux" | "node" | "python"
type InstalledPackage = { name: string; version: string }
type AvailablePackage = { name: string; description: string }
type PackageSummary = {
  installed: Array<InstalledPackage & { ecosystem: PackageEcosystem }>
  state: string
  truncated: boolean
  observedAt: string
  updates: { state: string; candidates: string[] }
}
type PackageKind = "install" | "remove" | "upgrade" | "upgrade-all"
type SelectedPackage = { name: string; ecosystem: PackageEcosystem; version?: string; description?: string }
type PackagePlan = { kind: PackageKind; name?: string; output: string }
type PackageInventory = { packages: InstalledPackage[]; truncated: boolean }

const validPackageName = (value: string) => /^[a-z0-9][a-z0-9+.-]{0,39}$/.test(value)

export function PackageManager({
  summary, summaryError = false, refreshToken = 0, onChanged,
}: {
  summary?: PackageSummary | null
  summaryError?: boolean
  refreshToken?: number
  onChanged?: () => void
}) {
  const [ecosystem, setEcosystem] = React.useState<PackageEcosystem>("termux")
  const [view, setView] = React.useState<"installed" | "available">("installed")
  const [installed, setInstalled] = React.useState<PackageInventory | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [reload, setReload] = React.useState(0)
  const [query, setQuery] = React.useState("")
  const [sort, setSort] = React.useState<"name" | "version">("name")
  const [descending, setDescending] = React.useState(false)
  const [selected, setSelected] = React.useState<SelectedPackage | null>(null)
  const [found, setFound] = React.useState<{ packages: AvailablePackage[]; truncated: boolean } | null>(null)
  const [catalogBusy, setCatalogBusy] = React.useState(false)
  const [operationBusy, setOperationBusy] = React.useState(false)
  const [plan, setPlan] = React.useState<PackagePlan | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [inventoryError, setInventoryError] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [output, setOutput] = React.useState("")

  React.useEffect(() => {
    let active = true
    void inspect<PackageInventory>("packages").then(result => {
      if (!Array.isArray(result.packages) || result.packages.length > 700 ||
        result.packages.some(item => !item || typeof item.name !== "string" || typeof item.version !== "string"))
        throw new Error("Invalid package inventory")
      if (active) { setInstalled(result); setInventoryError(false) }
    }).catch(() => { if (active) setInventoryError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refreshToken, reload])

  // Installed inventory and catalog search share an input, but switching back
  // to installed must not retain a catalog-only filter or package selection.
  const changeView = (next: "installed" | "available") => {
    setView(next)
    if (next === "installed") setQuery("")
    setSelected(null); setPlan(null); setError(null); setMessage(null); setOutput("")
  }
  const changeEcosystem = (next: PackageEcosystem) => {
    setEcosystem(next); setView("installed"); setQuery(""); setSelected(null); setPlan(null); setFound(null)
    setError(null); setMessage(null); setOutput("")
  }
  const choose = (item: SelectedPackage) => {
    setSelected(item); setPlan(null); setError(null); setMessage(null); setOutput("")
  }
  const changeQuery = (value: string) => {
    setQuery(value); setPlan(null); setFound(null); setSelected(null); setError(null)
  }
  const visible = (ecosystem === "termux"
    ? (installed?.packages ?? []).map(item => ({ ...item, ecosystem: "termux" as const }))
    : (summary?.installed ?? []).filter(item => item.ecosystem === ecosystem))
    .filter(item => (item.name + " " + item.version).toLowerCase().includes(query.toLowerCase().trim()))
    .sort((a, b) => {
      const comparison = a[sort].localeCompare(b[sort], undefined, { numeric: true }) || a.name.localeCompare(b.name)
      return descending ? -comparison : comparison
    })
  const chooseSort = (column: "name" | "version") => {
    if (sort === column) setDescending(previous => !previous)
    else { setSort(column); setDescending(false) }
  }
  const searchCatalog = async () => {
    const term = query.trim().toLowerCase()
    if (catalogBusy || operationBusy || ecosystem !== "termux" || !validPackageName(term)) return
    setView("available"); setCatalogBusy(true); setError(null); setFound(null)
    try {
      const result = await inspect<{ packages: AvailablePackage[]; truncated: boolean }>("search-packages", term)
      if (!Array.isArray(result.packages) || result.packages.length > 60) throw new Error("Invalid catalog")
      setFound(result)
    } catch { setError("Termux catalog search failed.") }
    finally { setCatalogBusy(false) }
  }
  const request = async (kind: PackageKind | "refresh", preview: boolean, name?: string): Promise<CommandResponse> => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PocketHost-Intent": "termux-admin" },
      credentials: "same-origin",
      body: JSON.stringify({
        action: preview ? "package-preview" : "package",
        name: kind,
        path: kind === "install" || kind === "remove" || kind === "upgrade" ? name : undefined,
      }),
    })
    if (!response.ok) throw new Error("HTTP " + response.status)
    const data = await response.json() as CommandResponse
    if (!data?.result || typeof data.result.exit !== "number" || typeof data.result.output !== "string")
      throw new Error("Invalid apt response")
    if (data.result.exit !== 0) throw new Error("apt exit " + data.result.exit)
    return data
  }
  const preview = async (kind: PackageKind) => {
    const name = kind === "upgrade-all" ? undefined : selected?.ecosystem === "termux" ? selected.name : undefined
    if (operationBusy || catalogBusy || (kind !== "upgrade-all" && (!name || !validPackageName(name)))) return
    setOperationBusy(true); setPlan(null); setError(null); setMessage(null); setOutput("")
    try {
      const data = await request(kind, true, name)
      setPlan({ kind, name, output: data.result.output })
      setOutput(data.result.output)
      setMessage("Preview ready · no changes made")
    } catch (cause) {
      setError("Preview failed (" + (cause instanceof Error ? cause.message : "unknown") + "). No changes made.")
    } finally { setOperationBusy(false) }
  }
  const reconcile = () => {
    setReload(current => current + 1)
    onChanged?.()
  }
  const apply = async () => {
    const approved = plan
    if (!approved || operationBusy ||
      (approved.kind !== "upgrade-all" && (selected?.ecosystem !== "termux" || selected.name !== approved.name))) return
    if (!window.confirm("Apply Termux " + approved.kind +
      (approved.name ? " " + approved.name : "") + " after preview? This changes installed packages.")) return
    setOperationBusy(true); setPlan(null); setError(null); setMessage(null); setOutput("")
    try {
      const data = await request(approved.kind, false, approved.name)
      setOutput(data.result.output)
      setMessage("Operation completed · inventory refresh requested")
    } catch (cause) {
      setError("Result unconfirmed (" + (cause instanceof Error ? cause.message : "connection lost") +
        "). Inspect installed packages before retrying. No automatic retry.")
    } finally {
      setOperationBusy(false); setFound(null); reconcile()
    }
  }
  const refreshIndexes = async () => {
    if (operationBusy || !window.confirm("Refresh Termux apt indexes? This changes local package metadata.")) return
    setOperationBusy(true); setPlan(null); setMessage(null); setError(null); setOutput("")
    try {
      const data = await request("refresh", false)
      setOutput(data.result.output)
      setMessage("Package indexes refreshed")
    } catch (cause) {
      setError("Index refresh result unconfirmed (" + (cause instanceof Error ? cause.message : "connection lost") + ").")
    } finally {
      setOperationBusy(false); setFound(null); reconcile()
    }
  }
  const selectedInstalled = selected?.ecosystem === "termux" &&
    installed?.packages.some(item => item.name === selected.name)
  const canManage = selected?.ecosystem === "termux" && validPackageName(selected.name)
  const isBusy = operationBusy || catalogBusy
  const cachedUpdateHints = new Set(summary?.updates.state === "cached-unverified"
    ? summary.updates.candidates : [])
  const counts = {
    termux: installed?.packages.length ?? null,
    node: summary?.installed.filter(item => item.ecosystem === "node").length ?? null,
    python: summary?.installed.filter(item => item.ecosystem === "python").length ?? null,
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2" aria-label="Package ecosystems">
      {(["termux", "node", "python"] as const).map(item =>
        <Button key={item} variant={ecosystem === item ? "secondary" : "outline"}
          onClick={() => changeEcosystem(item)} disabled={isBusy}>
          {item === "termux" ? "Termux" : item === "node" ? "Node" : "Python"} · {counts[item] ?? "—"}
        </Button>)}
      {ecosystem !== "termux" && <Badge variant="outline">Read-only sample</Badge>}
      {ecosystem === "termux" && installed?.truncated && <Badge variant="outline">Partial inventory</Badge>}
      {ecosystem === "termux" && summary?.updates.state === "cached-unverified" &&
        <Badge variant="outline">{summary.updates.candidates.length} cached update hints · unverified</Badge>}
    </div>

    {ecosystem === "termux" && <div role="tablist" aria-label="Package views" className="flex flex-wrap gap-2">
      <Button role="tab" aria-selected={view === "installed"}
        variant={view === "installed" ? "secondary" : "outline"} disabled={isBusy}
        onClick={() => changeView("installed")}>Installed</Button>
      <Button role="tab" aria-selected={view === "available"}
        variant={view === "available" ? "secondary" : "outline"} disabled={isBusy}
        onClick={() => changeView("available")}>Available</Button>
    </div>}
    <div className="flex flex-wrap gap-2">
      <Input aria-label="Search packages" className="min-w-44 flex-1" placeholder="Search packages…"
        value={query} disabled={isBusy} onChange={event => changeQuery(event.target.value)} />
      {ecosystem === "termux" && <>
        <Button variant="outline" disabled={isBusy || !validPackageName(query.trim().toLowerCase())}
          onClick={() => void searchCatalog()}>Search catalog</Button>
        <Button variant="outline" disabled={isBusy}
          title="Refreshes local apt metadata only; it does not install updates"
          onClick={() => void refreshIndexes()}>Check updates</Button>
        <Button variant="outline" disabled={isBusy}
          onClick={() => void preview("upgrade-all")}>Preview all upgrades</Button>
      </>}
    </div>

    {inventoryError && ecosystem === "termux" &&
      <p role="alert">Termux inventory unavailable. {installed ? "Showing last successful result." : "Try Refresh."}</p>}
    {summaryError && ecosystem !== "termux" && <p role="alert">Ecosystem metadata may be outdated.</p>}
    {loading && !installed && ecosystem === "termux" && view === "installed" &&
      <div aria-label="Loading package inventory" className="space-y-2">
        {[0, 1, 2].map(item => <div key={item} className="h-7 animate-pulse rounded bg-muted" />)}
      </div>}
    {(ecosystem !== "termux" || view === "installed") && (!loading || installed || ecosystem !== "termux") &&
      <div className="max-h-[30rem] overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b">
              <th className="p-2 text-left" aria-sort={sort === "name" ? (descending ? "descending" : "ascending") : "none"}>
                <Button type="button" variant="ghost" className="min-w-8" onClick={() => chooseSort("name")}>
                  Package {sort === "name" ? (descending ? "↓" : "↑") : ""}
                </Button>
              </th>
              <th className="p-2 text-left" aria-sort={sort === "version" ? (descending ? "descending" : "ascending") : "none"}>
                <Button type="button" variant="ghost" className="min-w-8" onClick={() => chooseSort("version")}>
                  Version {sort === "version" ? (descending ? "↓" : "↑") : ""}
                </Button>
              </th>
              {ecosystem === "termux" && <th className="p-2 text-left">Updates</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map(item => <tr key={item.ecosystem + ":" + item.name}
              className={selected?.ecosystem === item.ecosystem && selected.name === item.name ? "bg-muted/50" : "border-b"}>
              <td className="p-2"><Button type="button" variant="link" className="min-w-8 justify-start"
                disabled={isBusy} onClick={() => choose(item)}>{item.name}</Button></td>
              <td className="p-2 font-mono text-xs">{item.version}</td>
              {ecosystem === "termux" && <td className="p-2 text-xs">
                {cachedUpdateHints.has(item.name) ? <Badge variant="outline">Cached hint</Badge> :
                  <span aria-label="No cached update hint" className="text-muted-foreground">—</span>}
              </td>}
            </tr>)}
          </tbody>
        </table>
        {visible.length === 0 && !inventoryError && <p className="p-3 text-sm text-muted-foreground">No matching installed packages.</p>}
      </div>}

    {ecosystem === "termux" && view === "available" && !found && !catalogBusy &&
      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        Search the Termux catalog above. Results are separate from installed packages and searching makes no changes.
      </p>}
    {found && ecosystem === "termux" && view === "available" && <div className="space-y-1">
      <p className="text-sm font-medium">Catalog results · {found.packages.length}{found.truncated ? "+" : ""}</p>
      <div className="max-h-56 overflow-auto rounded-md border">
        {found.packages.map(item => <button type="button" key={item.name}
          className="block w-full border-b p-2 text-left text-sm hover:bg-muted" disabled={isBusy}
          onClick={() => choose({ ecosystem: "termux", name: item.name, description: item.description,
            version: installed?.packages.find(entry => entry.name === item.name)?.version })}>
          <span className="font-medium">{item.name}</span>
          {item.description && <span className="ml-2 text-muted-foreground">{item.description}</span>}
        </button>)}
        {found.packages.length === 0 && <p className="p-3 text-sm">No catalog matches.</p>}
      </div>
    </div>}

    {selected && <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{selected.name}</span>
        <Badge variant="outline">{selected.ecosystem !== "termux" ? "Read-only" :
          selectedInstalled ? "Installed" : "Not installed"}</Badge>
      </div>
      {selected.version && <p className="font-mono text-xs">{selected.version}</p>}
      {selected.ecosystem === "termux" && cachedUpdateHints.has(selected.name) &&
        <p className="text-muted-foreground text-xs">Cached update hint · verify with Check updates before applying.</p>}
      {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
      {canManage && <div className="flex flex-wrap gap-2">
        <Button disabled={isBusy} onClick={() => void preview("install")}>Preview install</Button>
        <Button variant="outline" disabled={isBusy || !selectedInstalled}
          onClick={() => void preview("upgrade")}>Preview upgrade</Button>
        <Button variant="outline" disabled={isBusy || !selectedInstalled}
          onClick={() => void preview("remove")}>Preview removal</Button>
      </div>}
    </div>}

    {plan && <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Preview: {plan.kind}{plan.name ? " · " + plan.name : ""}</p>
      <p className="text-xs text-muted-foreground">Apt simulation only. Confirm before applying.</p>
      <Button disabled={isBusy} onClick={() => void apply()}>Apply previewed changes</Button>
    </div>}
    {operationBusy && <p role="status">Termux operation in progress…</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {output && <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 text-xs">{output}</pre>}
  </div>
}
