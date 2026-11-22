import * as React from "react"
import type { FleetSite } from "@/lib/site-fleet-schema"
import { endpoint, maxStarterHtml, readSignal, starterHtml } from "./site-client"

/** Keep obsolete HTML reads from reopening an editor for a different inventory revision. */
export function useSiteHtmlEditor(
  site: FleetSite, epoch: React.RefObject<number>, busy: boolean,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
) {
  const [html, setHtml] = React.useState(starterHtml)
  const [visible, setVisible] = React.useState(false)
  const [htmlLoading, setHtmlLoading] = React.useState(false)
  const [editorRelease, setEditorRelease] = React.useState<string | null | undefined>(undefined)
  const generation = React.useRef(0)
  const pending = React.useRef(false)
  const editorVisible = visible &&
    (editorRelease === undefined || editorRelease === site.activeRelease)
  const editorReady = editorVisible && editorRelease !== undefined

  const closeHtmlEditor = () => {
    generation.current++
    pending.current = false
    setHtmlLoading(false)
    setVisible(false)
    setEditorRelease(undefined)
  }

  React.useEffect(() => {
    // Refreshing owned inventory invalidates a pending editor load, not a saved draft.
    if (pending.current) closeHtmlEditor()
  }, [site])

  const toggleHtmlEditor = () => {
    if (editorVisible) { closeHtmlEditor(); return }
    if (busy || htmlLoading || site.state === "unknown" || site.fileCount > 1) return
    setVisible(true)
    setEditorRelease(undefined)
    setError(null)
    if (!site.activeRelease) {
      setHtml(starterHtml)
      setEditorRelease(null)
      return
    }
    const revision = epoch.current
    const request = ++generation.current
    pending.current = true
    setHtmlLoading(true)
    void fetch(endpoint + "/" + site.id + "/html", {
      credentials: "same-origin", cache: "no-store", signal: readSignal(),
    }).then(async response => {
      if (!response.ok) throw new Error("Could not load the published HTML for editing.")
      const result: unknown = await response.json()
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw new Error("Invalid HTML source response.")
      const source = result as { release?: unknown; html?: unknown }
      if (source.release !== site.activeRelease || typeof source.html !== "string")
        throw new Error("Active release changed. Refresh before editing.")
      if (new TextEncoder().encode(source.html).length > maxStarterHtml)
        throw new Error("Current HTML is larger than the 32 KiB editor limit.")
      if (revision !== epoch.current || request !== generation.current || !pending.current) return
      setHtml(source.html)
      setEditorRelease(site.activeRelease)
    }).catch(cause => {
      if (revision === epoch.current && request === generation.current && pending.current)
        setError(cause instanceof Error ? cause.message : "Could not load the published HTML.")
    }).finally(() => {
      if (revision !== epoch.current || request !== generation.current) return
      pending.current = false
      setHtmlLoading(false)
    })
  }

  return { html, setHtml, htmlLoading, editorRelease, editorVisible, editorReady,
    toggleHtmlEditor, closeHtmlEditor }
}
