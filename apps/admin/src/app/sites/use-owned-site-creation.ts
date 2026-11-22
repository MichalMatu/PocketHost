import * as React from "react"
import type { FleetSite } from "@/lib/site-fleet-schema"
import { verifyCreatedSiteReadback } from "./verify-created-site"
import {
  endpoint, starterHtml, maxStarterHtml, encodeBase64, mutate, encodeStaticFolder,
  StaticSiteInputRejected, validateStaticZipSelection, inspectInitialStaticZip,
} from "./site-client"

type CreationOptions = {
  sitesCount: number
  loading: boolean
  error: string | null
  setSites: React.Dispatch<React.SetStateAction<FleetSite[]>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
}

/** Owns the single-request Static Hosting create/import flow and its form state. */
export function useOwnedSiteCreation({
  sitesCount, loading, error, setSites, setError,
}: CreationOptions) {
  const createInFlight = React.useRef(false)
  const [name, setName] = React.useState("")
  const [initialZip, setInitialZip] = React.useState<File | null>(null)
  const [initialFolder, setInitialFolder] = React.useState<File[]>([])
  const [publishStarter, setPublishStarter] = React.useState(false)
  const [initialHtml, setInitialHtml] = React.useState(starterHtml)
  const initialZipInput = React.useRef<HTMLInputElement>(null)
  const initialFolderInput = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    initialFolderInput.current?.setAttribute("webkitdirectory", "")
    initialFolderInput.current?.setAttribute("directory", "")
  }, [])
  const [creating, setCreating] = React.useState(false)
  const [inputError, setInputError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const createSite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (createInFlight.current || creating || loading || error !== null || sitesCount >= 8) return
    const firstRelease = initialZip
    const firstFolder = initialFolder
    const starter = publishStarter && firstRelease === null && firstFolder.length === 0
    const hasFirstFiles = firstRelease !== null || firstFolder.length > 0 || starter
    if (starter) {
      const htmlBytes = new TextEncoder().encode(initialHtml)
      if (!initialHtml.trim()) {
        setInputError("Initial index.html cannot be empty.")
        setNotice(null)
        return
      }
      if (htmlBytes.length > maxStarterHtml) {
        setInputError("Initial HTML is larger than 32 KiB. Use ZIP or folder import instead.")
        setNotice(null)
        return
      }
    }
    if (firstRelease) {
      const invalid = validateStaticZipSelection(firstRelease)
      if (invalid) {
        setInputError(invalid)
        setNotice(null)
        return
      }
    }
    // A synchronous latch closes the gap before React commits the disabled button.
    createInFlight.current = true
    setCreating(true)
    setInputError(null)
    setNotice(null)
    try {
      if (firstRelease) {
        const structuralError = await inspectInitialStaticZip(firstRelease)
        if (structuralError) {
          setInputError(structuralError)
          return
        }
      }
      let created: FleetSite
      try {
        const folderPayload = firstFolder.length ? await encodeStaticFolder(firstFolder) : null
        const starterPayload = starter ? JSON.stringify({ files: [{
          name: "index.html", base64: encodeBase64(new TextEncoder().encode(initialHtml)),
        }] }) : null
        const importEndpoint = endpoint + "/import?name=" + encodeURIComponent(name.trim())
        created = firstRelease
          ? await mutate(importEndpoint, "POST", firstRelease, "application/zip")
          : folderPayload !== null || starterPayload !== null
            ? await mutate(importEndpoint, "POST", folderPayload ?? starterPayload!, "application/json")
            : await mutate(endpoint + "/", "POST",
              JSON.stringify({ name: name.trim() }), "application/json")
      } catch (cause) {
        if (cause instanceof StaticSiteInputRejected) {
          setInputError(cause.message)
        } else {
          setSites([])
          setError(hasFirstFiles
            ? "Create and " + (firstRelease ? "ZIP " : firstFolder.length ? "folder " : "HTML ") +
              "import result unconfirmed. Refresh before retrying; no automatic retry."
            : "Create result unconfirmed. Refresh before retrying.")
        }
        return
      }
      try {
        const observed = await verifyCreatedSiteReadback(created, name.trim(), hasFirstFiles)
        setSites(observed)
        setName("")
        setInitialZip(null)
        setInitialFolder([])
        setPublishStarter(false)
        setInitialHtml(starterHtml)
        if (initialZipInput.current) initialZipInput.current.value = ""
        if (initialFolderInput.current) initialFolderInput.current.value = ""
        setNotice(hasFirstFiles
          ? 'Site "' + created.name + '" created and ' +
            (firstRelease ? "ZIP" : firstFolder.length ? "folder" : "starter HTML") +
            ' published as its first immutable release. Press Start when ready.'
          : 'Site "' + created.name + '" created. Edit HTML to publish the first release.')
      } catch {
        setSites([])
        setError(hasFirstFiles
          ? 'Initial import was acknowledged, but its site/release could not be confirmed. Refresh before retrying; no automatic retry.'
          : "Creation was acknowledged, but the new site's identity and stopped state could not be confirmed. Refresh before retrying; no automatic retry.")
      }
    } finally {
      createInFlight.current = false
      setCreating(false)
    }
  }

  return {
    name, setName, initialZip, setInitialZip, initialFolder, setInitialFolder,
    publishStarter, setPublishStarter, initialHtml, setInitialHtml,
    initialZipInput, initialFolderInput, creating, inputError, setInputError,
    notice, setNotice, createSite,
  }
}
