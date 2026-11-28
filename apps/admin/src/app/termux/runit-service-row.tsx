import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { isPanelService, type RunitEntry } from "./runit-service-inventory"

type ServiceRowProps = {
  service: RunitEntry
  mode: "lifecycle" | "autostart"
  busy: boolean
  perform: (name: "start" | "stop" | "restart" | "enable" | "disable", service: RunitEntry) => Promise<void>
  readServiceLogs: (name: string) => Promise<void>
  reviewPythonSource: (name: string) => Promise<void>
  reviewNodeSource: (name: string) => Promise<void>
  archiveWorker: (service: RunitEntry) => Promise<void>
}

export function RunitServiceRow({
  service, mode, busy, perform, readServiceLogs,
  reviewPythonSource, reviewNodeSource, archiveWorker,
}: ServiceRowProps) {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
      <div className="space-y-1">
        <p className="text-sm font-medium">{service.name}</p>
        <div className="flex flex-wrap gap-2" aria-label={"Status for " + service.name}>
          <Badge variant="outline">State: {service.state}</Badge>
          <Badge variant="outline">{service.enabled === null || service.enabled === undefined ? "Autostart unknown" :
            service.enabled ? "Autostart enabled" : "Autostart disabled"}</Badge>
          <Badge variant="outline">{isPanelService(service) ? "PocketHost-owned" :
            service.control === "standalone" ? "Standalone · attested" :
            service.control === "delegated" ? "Provisioner-owned · attested" :
            service.identity === "archive-conflict" ? "Archive conflict · blocked" :
            service.identity === "changed" ? "Identity changed · blocked" :
            service.identity === "legacy" ? "Legacy record · needs reattestation" :
            service.identity === "unregistered" ? "Discovered · unverified" : "Protected · read-only"}</Badge>
          {service.template && <Badge variant="outline">{service.template === "node-source-v1" ? "Node.js source · execution blocked" :
            service.template === "python-source-v1" ? "Python source · execution blocked" :
            service.template === "python-heartbeat-v1" ? "Python heartbeat" : "Node.js heartbeat"}</Badge>}
          {service.project && <Badge variant="outline">Node project: {service.project.name}</Badge>}
        </div>
      </div>
      {service.control === "read-only" && service.identityReason &&
        <p className="text-xs text-muted-foreground" aria-label={"Ownership for " + service.name}>
          {service.identityReason === "worker-provenance-changed" ? "Worker owner marker, source, logger or runit link is unverified. Controls blocked; inspect before repair." :
           service.identityReason === "service-not-published" ? "Enrolled service is missing from runit. No commands allowed; inspect before repair." :
           service.identityReason === "service-target-changed" ? "Recorded service path no longer matches. Commands blocked." :
           service.identityReason === "run-script-changed" ? "Recorded run script SHA-256 no longer matches. Commands blocked." :
           service.identityReason === "legacy-without-sha" ? "Old enrollment lacks a verified script digest. Commands blocked." :
           service.identityReason === "archive-live-conflict" ? "Archived and live enrollment conflict. Commands blocked." :
           service.identityReason === "no-enrollment" ? "Discovered only; no verified enrollment. Commands blocked." :
           "Protected system service. Commands blocked."}
        </p>}
      {mode === "autostart" && service.control === "standalone" && <p
        className="text-xs text-muted-foreground"
        role={service.enabled == null ||
          (service.enabled && service.state === "stopped") ||
          (service.enabled === false && service.state === "running") ? "alert" : undefined}>
        {service.enabled == null || service.state === "unknown"
          ? "Runit policy or process state unverified. No action inferred."
          : service.template === "python-source-v1" || service.template === "node-source-v1"
            ? service.enabled || service.state === "running"
              ? "Custom source is active despite LAN execution restrictions. Inspect locally; do not assume ownership of its process."
              : "Custom source staged and stopped. LAN activation remains blocked."
            : service.enabled && service.state === "running"
              ? "Runit policy: start enabled; supervisor reports running. Application readiness not verified."
              : service.enabled && service.state === "stopped"
                ? "Policy/state mismatch: runit enabled, worker stopped. Inspect Health; no automatic recovery."
                : !service.enabled && service.state === "running"
                  ? "Policy/state mismatch: runit disabled, worker still running. Inspect before changing policy."
                  : "Runit policy: manual stop recorded; worker stopped. Android boot behavior not verified."}
      </p>}
      {service.state === "unknown" && mode === "lifecycle" &&
        <p className="text-xs text-muted-foreground">
          Runtime state unknown. Start, Stop and Restart require a confirmed state.
        </p>}
      {service.control === "delegated" && <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Managed by its creator. Generic runit actions are blocked to protect release identity.
        </span>
        <Link to={service.project ? "/projects?project=" + encodeURIComponent(service.project.id) : "/projects"}
          className={buttonVariants({ variant: "link" })}>
          {service.project ? "Open owning project" : "Review Projects"}
        </Link>
      </div>}
      {service.control === "standalone" && !isPanelService(service) && <div className="flex flex-wrap gap-1">
        {mode === "lifecycle" ? (service.registered ? <>
          <Button disabled={busy || service.state !== "stopped" ||
              (service.template === "python-source-v1" || service.template === "node-source-v1")}
            onClick={() => void perform("start", service)}>Start</Button>
          <Button variant="outline" disabled={busy || service.state !== "running"}
            onClick={() => void perform("stop", service)}>Stop</Button>
          <Button variant="outline" disabled={busy || service.state !== "running" ||
              (service.template === "python-source-v1" || service.template === "node-source-v1")}
            onClick={() => void perform("restart", service)}>Restart</Button>
          <Button variant="outline" disabled={busy}
            onClick={() => void readServiceLogs(service.name)}>Logs</Button>
          {service.template === "python-source-v1" &&
            <Button variant="outline" disabled={busy}
              onClick={() => void reviewPythonSource(service.name)}>Review Python source</Button>}
          {service.template === "node-source-v1" &&
            <Button variant="outline" disabled={busy}
              onClick={() => void reviewNodeSource(service.name)}>Review Node.js source</Button>}
          {service.template &&
            <Button variant="outline"
              disabled={busy || service.state !== "stopped" || service.enabled !== false}
              title="Archive only the attested PocketHost worker. Keeps its script and logs."
              onClick={() => void archiveWorker(service)}>Archive worker</Button>}
        </> : <span className="text-xs text-muted-foreground">Not enrolled</span>) :
          (service.registered ? <>
            <Button variant="outline"
              disabled={busy || service.enabled !== false ||
                (service.template === "python-source-v1" || service.template === "node-source-v1")}
              onClick={() => void perform("enable", service)}>Enable autostart</Button>
            <Button variant="outline"
              disabled={busy || service.enabled !== true}
              onClick={() => void perform("disable", service)}>Disable autostart</Button>
          </> : <span className="text-xs text-muted-foreground">
            Not enrolled · register in Runit services first
          </span>)}
      </div>}
  </div>
}
