import type { Dispatch, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { WorkerTemplate, RunitEntry, ArchivedEntry } from "./runit-service-inventory"

type CreatorProps = {
  busy: boolean
  services: RunitEntry[] | null
  archived: ArchivedEntry[]
  creatorOpen: boolean
  setCreatorOpen: Dispatch<SetStateAction<boolean>>
  workerName: string
  setWorkerName: (value: string) => void
  workerTemplate: WorkerTemplate
  setWorkerTemplate: (value: WorkerTemplate) => void
  pythonSource: string
  setPythonSource: (value: string) => void
  createWorker: () => Promise<void>
}

export function RunitWorkerCreator({
  busy, services, archived, creatorOpen, setCreatorOpen, workerName, setWorkerName,
  workerTemplate, setWorkerTemplate, pythonSource, setPythonSource, createWorker,
}: CreatorProps) {
  return <>
  <div className="flex flex-wrap items-center justify-between gap-2">
    <p className="text-muted-foreground text-xs">
      Standalone workers need no Project. Only PocketHost-created, attested services can be managed.
    </p>
    <Button variant="outline"
      disabled={busy || (!creatorOpen && !services)}
      onClick={() => setCreatorOpen(open => !open)}>
      {creatorOpen ? "Close creator" : "Add Service"}
    </Button>
  </div>
  {creatorOpen && <div className="space-y-3 rounded-md border p-3" aria-label="Add standalone service">
    <p className="text-sm font-medium">Create standalone service</p>
    <p className="text-muted-foreground text-xs">
      Create a fixed Node.js/Python heartbeat worker, or stage your own
      immutable Python/Node.js source. Source is never executed or enabled by
      this LAN page; only a separately authorized local owner workflow
      can review activation. Maximum four definitions and 32 KB per source.
      No process adoption or arbitrary service path is allowed.
    </p>
    <div className="flex flex-wrap gap-2" aria-label="Worker runtime">
      <Button disabled={busy}
        variant={workerTemplate === "heartbeat-worker-v1" ? "secondary" : "outline"}
        aria-pressed={workerTemplate === "heartbeat-worker-v1"}
        onClick={() => setWorkerTemplate("heartbeat-worker-v1")}>Node.js</Button>
      <Button disabled={busy}
        variant={workerTemplate === "python-heartbeat-v1" ? "secondary" : "outline"}
        aria-pressed={workerTemplate === "python-heartbeat-v1"}
        onClick={() => setWorkerTemplate("python-heartbeat-v1")}>Python heartbeat</Button>
      <Button disabled={busy}
        variant={workerTemplate === "python-source-v1" ? "secondary" : "outline"}
        aria-pressed={workerTemplate === "python-source-v1"}
        onClick={() => setWorkerTemplate("python-source-v1")}>My Python code</Button>
      <Button disabled={busy}
        variant={workerTemplate === "node-source-v1" ? "secondary" : "outline"}
        aria-pressed={workerTemplate === "node-source-v1"}
        onClick={() => setWorkerTemplate("node-source-v1")}>My Node.js code</Button>
    </div>
    {(workerTemplate === "python-source-v1" || workerTemplate === "node-source-v1") && <div className="space-y-2">
      <label htmlFor="python-worker-source" className="text-sm font-medium">
        {workerTemplate === "node-source-v1" ? "worker.mjs source" : "worker.py source"}
      </label>
      <Textarea id="python-worker-source" value={pythonSource}
        onChange={event => setPythonSource(event.target.value)}
        maxLength={32 * 1024} rows={7} disabled={busy}
        placeholder={workerTemplate === "node-source-v1" ? 'console.log("Hello from Node.js")' : 'print("Hello from Python")'} />
      <p className="text-xs text-muted-foreground">
        Stored privately without executing, dependencies or network listener.
        Start, Restart, Autostart and recovery are disabled from this page.
      </p>
    </div>}
    <div className="flex flex-wrap items-center gap-2">
      <Input aria-label="New service name" placeholder="e.g. monitoring-worker"
        className="min-w-48 max-w-72" maxLength={64} disabled={busy}
        value={workerName} onChange={event => setWorkerName(event.target.value.toLowerCase())} />
      <Button disabled={busy || !services ||
          services.some(item => item.name === workerName) ||
          archived.some(item => item.name === workerName) ||
          !/^[a-z][a-z0-9-]{1,63}$/.test(workerName) ||
          ((workerTemplate === "python-source-v1" || workerTemplate === "node-source-v1") &&
            (!pythonSource.trim() || new Blob([pythonSource]).size > 32 * 1024))}
        onClick={() => void createWorker()}>
        {workerTemplate === "node-source-v1" ? "Stage Node.js source" :
          workerTemplate === "python-source-v1" ? "Stage Python source" : "Create stopped service"}
      </Button>
    </div>
    <p className="text-muted-foreground text-xs">
      Names must be unique and 2–64 characters: lowercase letters, digits and hyphens.
      Creating a service never executes staged source or enables autostart.
    </p>
    {services && workerName &&
      (services.some(item => item.name === workerName) ||
        archived.some(item => item.name === workerName)) &&
      <p role="alert" className="text-destructive text-xs">
        Service name already exists or is archived. Choose a different name.
      </p>}
    {!services && <p role="status" className="text-muted-foreground text-xs">
      Service inventory unavailable. Refresh services before creating a worker.
    </p>}
  </div>}
  </>
}
