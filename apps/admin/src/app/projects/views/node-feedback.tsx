
import type { NodeProjectController } from "../state/use-node-project-controller"

export function NodeFeedback({ controller, showDiagnostics = true }: { controller: NodeProjectController; showDiagnostics?: boolean }) {
  const { toolchainStatus, toolchainError, nodeTools, error, message, registryStatus, registryError, registries } = controller
  return <>
    {showDiagnostics && toolchainStatus === "loading" && <p role="status" className="text-muted-foreground text-sm">
      Checking Node tools…
    </p>}
    {showDiagnostics && toolchainStatus === "error" && <p role="alert" className="text-destructive text-sm">
      {toolchainError}
    </p>}
    {showDiagnostics && nodeTools && <p role="status" className="text-muted-foreground text-sm">
      Installed tools: Node {nodeTools.nodeVersion ?? "not detected"} · npm {nodeTools.npmVersion ?? "not detected"}
    </p>}
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {showDiagnostics && registryStatus === "loading" && <p role="status" className="text-muted-foreground text-sm">
      Inspecting hosting registries…
    </p>}
    {showDiagnostics && registryStatus === "error" && <p role="alert" className="text-destructive text-sm">
      {registryError}
    </p>}
    {showDiagnostics && registries && <p className="text-muted-foreground text-sm" aria-label="Hosting registries">
      Modules: {registries.modules} · Services: {registries.services} · Projects: {registries.projects}.
      Declarations do not grant process ownership or lifecycle permission.
    </p>}
  </>
}
