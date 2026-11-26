import { siteDetailPath } from "@/app/sites/site-route"
import * as React from "react"
import { Link, useSearchParams } from "react-router-dom"
import { BaseLayout } from "@/components/layouts/base-layout"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  readProjectLogCatalog, readProjectLogLines,
  type LogSourceStatus, type ProjectLogTarget,
} from "@/lib/hosting-observability-client"

type LogState = "idle" | "loading" | "ready" | "error"
const errorPattern = /\b(error|failed|fatal|exception|denied|refused)\b/i

export default function RuntimeLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedRef = React.useRef<string | null>(null)
  const requestedProject = searchParams.get("project")
  React.useEffect(() => { requestedRef.current = requestedProject }, [requestedProject])
  const [targets, setTargets] = React.useState<ProjectLogTarget[]>([])
  const [selectedKey, setSelectedKey] = React.useState("")
  const [staticStatus, setStaticStatus] = React.useState<LogSourceStatus | "loading">("loading")
  const [nodeStatus, setNodeStatus] = React.useState<LogSourceStatus | "loading">("loading")
  const [catalogLoading, setCatalogLoading] = React.useState(true)
  const [lines, setLines] = React.useState<string[]>([])
  const [logState, setLogState] = React.useState<LogState>("idle")
  const [search, setSearch] = React.useState("")
  const [errorsOnly, setErrorsOnly] = React.useState(false)
  const version = React.useRef(0)

  const refreshCatalog = React.useCallback(async (signal?: AbortSignal) => {
    version.current += 1
    setCatalogLoading(true)
    setLines([])
    setLogState("idle")
    const result = await readProjectLogCatalog(signal)
    if (signal?.aborted) return
    setStaticStatus(result.staticStatus)
    setNodeStatus(result.nodeStatus)
    setTargets(result.targets)
    setSelectedKey(current => {
      const requested = requestedRef.current
      if (requested !== null)
        return result.targets.some(target => target.key === requested) ? requested : ""
      return result.targets.some(target => target.key === current) ? current : (result.targets[0]?.key ?? "")
    })
    setCatalogLoading(false)
  }, [])

  const loadLogs = React.useCallback(async (target: ProjectLogTarget) => {
    const requestVersion = ++version.current
    setLogState("loading")
    setLines([])
    try {
      const result = await readProjectLogLines(target)
      if (requestVersion !== version.current) return
      setLines(result)
      setLogState("ready")
    } catch {
      if (requestVersion !== version.current) return
      setLogState("error")
    }
  }, [])

  React.useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => refreshCatalog(controller.signal))
      .catch(() => {
        if (!controller.signal.aborted) {
          setStaticStatus("error")
          setNodeStatus("error")
          setTargets([])
          setSelectedKey("")
          setCatalogLoading(false)
        }
      })
    return () => { controller.abort(); version.current += 1 }
  }, [refreshCatalog])

  // Keep an already-loaded catalog in sync with browser Back/Forward and
  // same-route deep links. Never select a project missing from the owned catalog.
  React.useEffect(() => {
    if (catalogLoading || requestedProject === null) return
    const owned = targets.some(target => target.key === requestedProject)
    const next = owned ? requestedProject : ""
    let active = true
    void Promise.resolve().then(() => {
      if (active) setSelectedKey(current => current === next ? current : next)
    })
    return () => { active = false }
  }, [requestedProject, targets, catalogLoading])

  React.useEffect(() => {
    let active = true
    const target = targets.find(entry => entry.key === selectedKey &&
      (requestedProject === null || entry.key === requestedProject))
    if (target && !catalogLoading) {
      void Promise.resolve().then(() => {
        if (active) void loadLogs(target)
      })
    }
    else {
      version.current += 1
      void Promise.resolve().then(() => {
        if (!active) return
        setLines([])
        setLogState("idle")
      })
    }
    return () => { active = false; version.current += 1 }
  }, [selectedKey, targets, catalogLoading, loadLogs, requestedProject])

  const selected = targets.find(entry => entry.key === selectedKey &&
    (requestedProject === null || entry.key === requestedProject))
  const unknownRequested = !catalogLoading && requestedProject !== null &&
    !targets.some(entry => entry.key === requestedProject)
  const filtered = lines.filter(line =>
    (!errorsOnly || errorPattern.test(line)) &&
    line.toLowerCase().includes(search.trim().toLowerCase()))
  const hasSourceError = staticStatus === "error" || nodeStatus === "error"
  const projectLink = selected?.kind === "node"
    ? "/projects?project=" + encodeURIComponent(selected.id)
    : selected ? siteDetailPath(selected.id) : "/sites"

  return (
    <BaseLayout>
      <div className="space-y-4 px-4 pb-8 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Project logs</h1>
            <p className="text-sm text-muted-foreground">Read-only, on-demand logs from owned projects.</p>
          </div>
          <Link className={buttonVariants({ variant: "ghost", className: "min-h-10" })} to="/observability">Monitoring</Link>
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Choose project</CardTitle>
              <Button variant="ghost" className="min-h-10" disabled={catalogLoading} onClick={() => {
                void refreshCatalog().catch(() => {
                  setStaticStatus("error"); setNodeStatus("error")
                  setTargets([]); setSelectedKey(""); setCatalogLoading(false)
                })
              }}>Refresh project list</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {catalogLoading && <p role="status" className="text-sm">Loading owned projects…</p>}
            {staticStatus === "disabled" && <p className="text-sm text-muted-foreground">Static hosting is disabled.</p>}
            {nodeStatus === "disabled" && <p className="text-sm text-muted-foreground">Node Hosting is disabled.</p>}
            {unknownRequested && <p role="alert" className="text-sm text-destructive">
              Requested project is not in the verified owned inventory.
            </p>}
            {hasSourceError && <p role="alert" className="text-sm text-destructive">
              {staticStatus === "error" && nodeStatus === "error"
                ? "Static and Node project inventories are unavailable."
                : staticStatus === "error" ? "Static project inventory is unavailable."
                  : "Node project inventory is unavailable."}
              {" "}Unavailable projects are not shown.
            </p>}
            {!catalogLoading && targets.length === 0 && !hasSourceError &&
              <p className="text-sm text-muted-foreground">No owned projects have been created.</p>}
            {targets.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Choose owned project">
              {targets.map(target => <Button key={target.key}
                variant={target.key === selectedKey ? "default" : "outline"}
                className="min-h-10 max-w-full whitespace-normal break-all"
                aria-pressed={target.key === selectedKey}
                disabled={catalogLoading}
                onClick={() => {
                  setSelectedKey(target.key)
                  setSearchParams({ project: target.key })
                  setSearch("")
                  setErrorsOnly(false)
                }}>
                {target.name} ({target.kind === "static" ? "Static" : "Node.js"})
              </Button>)}
            </div>}
          </CardContent>
        </Card>
        {selected && <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="break-all">{selected.name}</CardTitle>
              <Button variant="outline" className="min-h-10" disabled={catalogLoading || logState === "loading"}
                onClick={() => void loadLogs(selected)}>Refresh logs</Button>
            </div>
            <CardDescription>
              {selected.kind === "static" ? "Static site activity" : "Node.js runit output"} ·
              Up to 50 lines · <Link className={buttonVariants({ variant: "link", className: "min-h-10 px-1 underline" })} to={projectLink}>
                {selected.kind === "node" ? "Open this project" : "Open Sites manager"}
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Input aria-label="Search logs" placeholder="Search log text" value={search}
                onChange={event => setSearch(event.target.value)} className="max-w-xs" />
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" checked={errorsOnly}
                  onChange={event => setErrorsOnly(event.target.checked)} />
                Errors only
              </label>
            </div>
            {logState === "loading" && <p role="status">Reading bounded project logs…</p>}
            {logState === "error" && <p role="alert" className="text-sm text-destructive">
              Logs are unavailable or project ownership could not be verified. No output is shown.
            </p>}
            {logState === "ready" && lines.length === 0 && <p role="status" className="text-sm text-muted-foreground">
              No recorded logs for this project.
            </p>}
            {logState === "ready" && lines.length > 0 && filtered.length === 0 &&
              <p role="status" className="text-sm text-muted-foreground">No log lines match the filter.</p>}
            {logState === "ready" && filtered.length > 0 &&
              <pre aria-label="Project log lines" className="max-h-96 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded-md bg-muted p-3 text-xs leading-relaxed">{filtered.join("\n")}</pre>}
          </CardContent>
        </Card>}
      </div>
    </BaseLayout>
  )
}
