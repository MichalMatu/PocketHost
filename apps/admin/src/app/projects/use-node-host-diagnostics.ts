import * as React from "react"
import { api } from "./node-project-client"

type ReadJson = (url: string) => Promise<Record<string, unknown>>
type ToolVersions = { nodeVersion: string | null; npmVersion: string | null }
type RegistryCounts = { modules: number; services: number; projects: number }
type ReadStatus = "idle" | "loading" | "ready" | "error"

/** Independent read-only diagnostics. Invalidates pending reads on registry loss. */
export function useNodeHostDiagnostics(getJson: ReadJson) {
  const [nodeTools, setNodeTools] = React.useState<ToolVersions | null>(null)
  const [registries, setRegistries] = React.useState<RegistryCounts | null>(null)
  const [toolchainStatus, setToolchainStatus] = React.useState<ReadStatus>("idle")
  const [registryStatus, setRegistryStatus] = React.useState<ReadStatus>("idle")
  const generation = React.useRef(0)
  const toolRequest = React.useRef(0)
  const registryRequest = React.useRef(0)

  const resetDiagnostics = React.useCallback(() => {
    generation.current += 1
    toolRequest.current += 1
    registryRequest.current += 1
    setNodeTools(null)
    setRegistries(null)
    setToolchainStatus("idle")
    setRegistryStatus("idle")
  }, [])

  React.useEffect(() => () => { generation.current += 1 }, [])

  const checkTools = React.useCallback(async (): Promise<boolean> => {
    const selectedGeneration = generation.current
    const request = ++toolRequest.current
    const current = () =>
      selectedGeneration === generation.current && request === toolRequest.current
    setNodeTools(null)
    setToolchainStatus("loading")
    try {
      const result = await getJson(api + "/toolchain")
      if (!current()) return false
      const tools = result.toolchain as Record<string, unknown> | undefined
      const version = (value: unknown) => value === null ||
        (typeof value === "string" && /^v?\d+\.\d+\.\d+$/.test(value))
      if (!tools || !version(tools.nodeVersion) || !version(tools.npmVersion))
        throw new Error("Invalid Node toolchain report")
      setNodeTools(tools as ToolVersions)
      setToolchainStatus("ready")
      return true
    } catch {
      if (!current()) return false
      setToolchainStatus("error")
      return false
    }
  }, [getJson])

  const inspectRegistries = React.useCallback(async (): Promise<boolean> => {
    const selectedGeneration = generation.current
    const request = ++registryRequest.current
    const current = () =>
      selectedGeneration === generation.current && request === registryRequest.current
    setRegistries(null)
    setRegistryStatus("loading")
    try {
      const response = await getJson(api + "/registry")
      if (!current()) return false
      const value = response.registries as Record<string, unknown> | undefined
      if (!value || !Array.isArray(value.modules) || value.modules.length > 32 ||
          !Array.isArray(value.services) || value.services.length > 64 ||
          !Array.isArray(value.projects) || value.projects.length > 64)
        throw new Error("Invalid Hosting registry projection")
      setRegistries({
        modules: value.modules.length,
        services: value.services.length,
        projects: value.projects.length,
      })
      setRegistryStatus("ready")
      return true
    } catch {
      if (!current()) return false
      setRegistryStatus("error")
      return false
    }
  }, [getJson])

  return {
    nodeTools, registries, toolchainStatus, registryStatus,
    checkTools, inspectRegistries, resetDiagnostics,
  }
}
