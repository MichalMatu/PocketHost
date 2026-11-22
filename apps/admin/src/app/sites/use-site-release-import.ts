import type * as React from "react"
import type { FleetSite } from "@/lib/site-fleet-schema"
import {
  endpoint, mutate, encodeStaticFolder,
  validateStaticZipSelection, validateStaticFolderSelection,
} from "./site-client"

type ExecuteImport = (
  job: () => Promise<unknown>,
  success: string,
  mutation?: boolean,
  expected?: (observed: FleetSite) => boolean,
) => Promise<void>

type Options = {
  site: FleetSite
  busy: boolean
  outcomeUnknown: boolean
  execute: ExecuteImport
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setMessage: React.Dispatch<React.SetStateAction<string | null>>
}

/** Existing-site ZIP/folder release controller; site readback stays in the owner gate. */
export function useSiteReleaseImport({
  site, busy, outcomeUnknown, execute, setError, setMessage,
}: Options) {
  const zip = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (!file || busy || outcomeUnknown || site.state === "unknown") return
    const invalid = validateStaticZipSelection(file)
    if (invalid) {
      setError(invalid)
      setMessage(null)
      return
    }
    // Valid new selection clears stale feedback even if confirmation is canceled.
    setError(null)
    setMessage(null)
    if (site.activeRelease && !window.confirm("Publish a new release of " + site.name + "?")) return
    void execute(() => mutate(endpoint + "/" + site.id + "/deploy", "PUT", file, "application/zip"),
      "ZIP was published as a new immutable release.", true,
      observed => observed.activeRelease !== null && observed.activeRelease !== site.activeRelease &&
        observed.fileCount > 0 && observed.bytes > 0)
  }
  const folder = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ""
    if (!files.length || busy || outcomeUnknown || site.state === "unknown") return
    const invalid = validateStaticFolderSelection(files)
    if (invalid) { setError(invalid); setMessage(null); return }
    // Valid new selection clears stale feedback even if confirmation is canceled.
    setError(null)
    setMessage(null)
    if (site.activeRelease && !window.confirm("Publish a new release of " + site.name + "?")) return
    void execute(async () => mutate(endpoint + "/" + site.id + "/deploy", "PUT",
      await encodeStaticFolder(files), "application/json"),
      "Folder was published as a new immutable release.", true,
    observed => observed.activeRelease !== null && observed.activeRelease !== site.activeRelease)
  }

  return { zip, folder }
}
