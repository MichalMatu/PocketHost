import { applyPackageAction, previewPackageAction } from "../../../src/modules/host/termux-admin.ts"
import type { AgentAction } from "../../../src/modules/host/local-agent-operations.ts"
import type { FileRoot } from "../../../src/modules/host/termux-file-roots.ts"
import type { TermuxAdminContext, TermuxAdminInput } from "./termux-admin-context.ts"

/** Typed action dispatch. The HTTP adapter remains the single serialization boundary. */
export async function runTermuxAdminAction(input: TermuxAdminInput, context: TermuxAdminContext) {
  const { files, backups, services, localAgentOperations, sshConnections, restic, fileRoots, terminal } = context
  if (input.action === "package-preview") {
    if (!input.name || !["install","remove","upgrade","upgrade-all"].includes(input.name))
      throw new RangeError("Invalid package preview")
    return { operation: input.name, result: await previewPackageAction(
      input.name as "install" | "remove" | "upgrade" | "upgrade-all",
      input.path,
    ) }
  }
  if (input.action === "package") {
    if (!input.name || !["refresh", "install", "remove", "upgrade", "upgrade-all"].includes(input.name))
      throw new RangeError("Invalid package action")
    return { operation: input.name, result: await applyPackageAction(
      input.name as "refresh" | "install" | "remove" | "upgrade" | "upgrade-all",
      input.path,
    ) }
  }
  if (input.action === "local-agent-operations") {
    const actions = ["agent-start","agent-stop","agent-pause","agent-resume",
      "ssh-start","ssh-stop","ssh-restart"] as const
    if (!input.name || !actions.includes(input.name as AgentAction) ||
        Object.keys(input).some(key => key !== "action" && key !== "name"))
      throw new RangeError("Invalid Local Agent action")
    return await localAgentOperations.apply(input.name as AgentAction)
  }
  if (input.action === "ssh-profile") {
    if (input.name === "connect" && typeof input.path === "string" &&
        Object.keys(input).every(key => ["action","name","path"].includes(key))) {
      return { terminal: await terminal.startSSH(sshConnections.find(input.path)),
        connections: sshConnections.list(), activeSession: terminal.session() }
    }
    if (input.name === "delete" && typeof input.path === "string" &&
        Object.keys(input).every(key => ["action","name","path"].includes(key))) {
      return { connections: sshConnections.delete(input.path),
        terminal: terminal.status(), activeSession: terminal.session() }
    }
    if (["add","update"].includes(input.name ?? "") && typeof input.content === "string" &&
        input.content.length <= 1500 &&
        Object.keys(input).every(key => ["action","name","path","content"].includes(key))) {
      const info: unknown = JSON.parse(input.content)
      return { connections: sshConnections.save(info,
        input.name === "update" ? input.path ?? "" : undefined),
        terminal: terminal.status(), activeSession: terminal.session() }
    }
    throw new RangeError("Invalid SSH connection operation")
  }
  if (input.action === "terminal") {
    if (input.name === "start") return { terminal: await terminal.start() }
    if (input.name === "stop") return { terminal: terminal.stop() }
    throw new RangeError("Invalid terminal action")
  }
  if (input.action === "full-file") {
    const root = (input.root ?? "") as FileRoot
    const relative = input.path ?? ""
    if (input.name === "read") return fileRoots.readText(root, relative)
    if (input.name === "export") return fileRoots.export(root, relative)
    if (["mkdir","save","copy","copy-tree","move","delete","delete-tree","upload"].includes(input.name ?? "")) {
      return fileRoots.apply(root, input.name as "mkdir"|"save"|"copy"|"copy-tree"|"move"|"delete"|"delete-tree"|"upload",
        relative, { destination: input.destination, content: input.content, base64: input.base64 })
    }
    throw new RangeError("Unknown filesystem operation")
  }
  if (input.action === "restic-system") {
    const scope = (input.root ?? "") as "home" | "prefix" | "all"
    if (!["home","prefix","all"].includes(scope)) throw new RangeError("Invalid backup scope")
    if (input.name === "backup") return { result: await restic.backupScope(scope) }
    if (input.name === "restore") return { result: await restic.restoreScopeToStaging(scope, input.path ?? "") }
    if (input.name === "forget") return { result: await restic.forgetScope(scope, input.path ?? "") }
    if (input.name === "check") return { result: await restic.check() }
    throw new RangeError("Invalid system Restic action")
  }
  if (input.action === "restic") {
    if (!input.name || !["init","backup","check","restore","forget"].includes(input.name))
      throw new RangeError("Invalid Restic operation")
    if (input.name === "init") return { restic: await restic.initialize() }
    if (input.name === "backup") return { result: await restic.backup() }
    if (input.name === "check") return { result: await restic.check() }
    if (input.name === "restore") return { result: await restic.restoreToStaging(input.path ?? "") }
    if (input.name === "forget") return { result: await restic.forget(input.path ?? "") }
  }
  if (input.action === "service-logs") {
    return services.logs(input.path ?? "")
  }
  if (input.action === "service-heartbeat") {
    // Persist only one of three built-in heartbeat freshness limits,
    // or disable the policy. No remote URL, script, port or command.
    if (!["disabled", "180", "300", "600"].includes(input.name ?? "") ||
        Object.keys(input).some(key => !["action", "name", "path"].includes(key)))
      throw new RangeError("Unsupported worker heartbeat policy");
    const seconds = input.name === "disabled"
      ? null : Number(input.name) as 180 | 300 | 600;
    return services.configureWorkerHeartbeat(input.path ?? "", seconds)
  }
  if (input.action === "service-recover") {
    // One explicit user-reviewed attempt for attested builtin workers.
    // The host enforces stop state, desired autostart and durable budget.
    if (input.name !== "once" ||
        Object.keys(input).some(key => !["action", "name", "path"].includes(key))) {
      throw new RangeError("Unsupported service recovery action");
    }
    return await services.recoverWorkerOnce(input.path ?? "")
  }
  if (input.action === "service-python-restore") {
    if (Object.keys(input).some(key =>
          !["action", "name", "path", "root", "destination"].includes(key)) ||
        typeof input.name !== "string" ||
        typeof input.root !== "string" ||
        typeof input.destination !== "string")
      throw new RangeError("Invalid Python restore request");
    return services.restorePythonSourceRevision(
      input.path ?? "", input.name, input.root, input.destination)
  }
  if (input.action === "service-python-update") {
    // Compare-and-swap only the exact, stopped, attested source.
    // No release execution, runtime enable or arbitrary file path.
    if (typeof input.content !== "string" ||
        typeof input.destination !== "string" ||
        Object.keys(input).some(key => !["action", "path", "destination", "content"].includes(key))) {
      throw new RangeError("Invalid Python revision request");
    }
    return services.updatePythonSource(
      input.path ?? "", input.destination, input.content)
  }
  if (input.action === "service-node-restore") {
    if (Object.keys(input).some(key =>
          !["action", "name", "path", "root", "destination"].includes(key)) ||
        typeof input.name !== "string" ||
        typeof input.root !== "string" ||
        typeof input.destination !== "string")
      throw new RangeError("Invalid Node.js restore request");
    return services.restoreNodeSourceRevision(
      input.path ?? "", input.name, input.root, input.destination)
  }
  if (input.action === "service-node-update") {
    // Stopped, source-attested compare-and-swap; never authorizes execution.
    if (typeof input.content !== "string" ||
        typeof input.destination !== "string" ||
        Object.keys(input).some(key => !["action", "path", "destination", "content"].includes(key))) {
      throw new RangeError("Invalid Node.js revision request");
    }
    return services.updateNodeSource(
      input.path ?? "", input.destination, input.content)
  }
  if (input.action === "service-create") {
    // Custom Node.js/Python source is staged only. The LAN cannot
    // authorize Start, Restart, Autostart or Recovery for it.
    const customSource = input.name === "python-source-v1" || input.name === "node-source-v1"
    if (!["heartbeat-worker-v1", "python-heartbeat-v1", "python-source-v1",
          "node-source-v1"].includes(input.name ?? "") ||
        Object.keys(input).some(key => !["action", "name", "path",
          ...(customSource ? ["content"] : [])].includes(key)) ||
        (customSource && (typeof input.content !== "string" ||
          Buffer.byteLength(input.content) > 32 * 1024))) {
      throw new RangeError("Unsupported worker source or template");
    }
    return services.createManagedWorker(input.path ?? "",
      input.name as "heartbeat-worker-v1" | "python-heartbeat-v1" | "python-source-v1" | "node-source-v1",
      input.content)
  }
  if (input.action === "service-archive") {
    // Narrow non-destructive archive, never generic unlink or adoption.
    if (!["heartbeat-worker-v1", "python-heartbeat-v1", "python-source-v1", "node-source-v1"].includes(input.name ?? "") ||
        Object.keys(input).some(key => !["action", "name", "path"].includes(key))) {
      throw new RangeError("Unsupported service archive");
    }
    return await services.archiveManagedWorker(input.path ?? "")
  }
  if (input.action === "service-restore") {
    // Restore only a previously recorded, stopped and fully attested
    // builtin worker; no browser-supplied path, run script or PID.
    if (!["heartbeat-worker-v1", "python-heartbeat-v1", "python-source-v1", "node-source-v1"].includes(input.name ?? "") ||
        Object.keys(input).some(key => !["action", "name", "path"].includes(key))) {
      throw new RangeError("Unsupported service restoration");
    }
    return services.restoreArchivedWorker(input.path ?? "",
      input.name as "heartbeat-worker-v1" | "python-heartbeat-v1" | "python-source-v1" | "node-source-v1")
  }
  if (input.action === "service-retire") {
    // Never recursively delete a worker. Revoke only an attested
    // archive and retain its bytes in bounded private quarantine.
    if (!["heartbeat-worker-v1", "python-heartbeat-v1", "python-source-v1", "node-source-v1"].includes(input.name ?? "") ||
        Object.keys(input).some(key => !["action", "name", "path"].includes(key))) {
      throw new RangeError("Unsupported worker retirement");
    }
    return services.retireArchivedWorker(input.path ?? "",
      input.name as "heartbeat-worker-v1" | "python-heartbeat-v1" | "python-source-v1" | "node-source-v1")
  }
  if (input.action === "service") {
    if (!input.name || !["start","stop","restart","enable","disable"].includes(input.name))
      throw new RangeError("Invalid runit operation")
    // The generic LAN UI can only mutate verified builtin
    // workers, never Node Hosting project processes, even though
    // the latter are enrolled in the shared runit registry.
    return await services.applyStandalone(
      input.name as "start" | "stop" | "restart" | "enable" | "disable",
      input.path ?? "",
    )
  }
  if (input.action === "file") {
    if (!input.name || !["mkdir", "save", "rename", "delete", "copy", "upload"].includes(input.name))
      throw new RangeError("Invalid file action")
    files.apply(input.name as "mkdir" | "save" | "rename" | "delete" | "copy" | "upload", input.path ?? "", {
      destination: input.destination, content: input.content, base64: input.base64,
    })
    return { changed: true }
  }
  if (input.action === "read-file") {
    return { content: files.read(input.path ?? "") }
  }
  if (input.action === "download-file") {
    return files.download(input.path ?? "")
  }
  if (input.action === "snapshot") {
    if (input.name === "create") return { snapshot: backups.create() }
    if (input.name === "verify") return { verification: backups.verify(input.path ?? "") }
    if (input.name === "restore") return { snapshot: backups.restore(input.path ?? "") }
    if (input.name === "delete") {
      backups.delete(input.path ?? "")
      return { changed: true }
    }
  }
  throw new RangeError("Unsupported typed action")
}
