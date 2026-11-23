import { FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { starterHtml } from "./site-client"
import type { useOwnedSiteCreation } from "./use-owned-site-creation"

type Props = {
  creation: ReturnType<typeof useOwnedSiteCreation>
  sitesCount: number
  loading: boolean
  error: string | null
}

/** Presentational Static Hosting create/import form; the hook owns validation and writes. */
export function SiteCreationForm({ creation, sitesCount, loading, error }: Props) {
  const {
    name, setName, initialZip, setInitialZip, initialFolder, setInitialFolder,
    publishStarter, setPublishStarter, initialHtml, setInitialHtml,
    initialZipInput, initialFolderInput, clearInitialZip, clearInitialFolder,
    creating, inputError, setInputError,
    setNotice, createSite,
  } = creation

  return (
    <Card>
      <CardHeader>
        <CardTitle>New hosted site</CardTitle>
        <CardDescription>HTML, CSS and JavaScript. Import a ZIP or folder; up to eight sites.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={createSite} aria-busy={creating} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="new-owned-site" className="sr-only">Site name</label>
            <Input id="new-owned-site" value={name}
              disabled={creating || loading}
              onChange={event => {
                setName(event.target.value)
                setInputError(null)
              }}
              placeholder="My first site" minLength={2} maxLength={60} required />
            <Button type="submit"
              disabled={creating || loading || error !== null || sitesCount >= 8 || name.trim().length < 2}>
              <FolderOpen /> {initialZip ? "Create and import ZIP" :
                initialFolder.length ? "Create and import folder" :
                publishStarter ? "Create with starter HTML" : "Create site"}
            </Button>
          </div>
          {creating && <p role="status" className="text-sm text-muted-foreground">
            Creating site and verifying readback…
          </p>}
          <div className="space-y-1">
            <label htmlFor="initial-owned-site-zip" className="text-sm font-medium">
              Initial ZIP (optional)
            </label>
            <Input id="initial-owned-site-zip" type="file" ref={initialZipInput}
              accept=".zip,application/zip" disabled={creating || loading}
              onChange={event => {
                const picked = event.currentTarget.files?.[0] ?? null
                setInitialZip(picked)
                if (picked) {
                  clearInitialFolder()
                  setPublishStarter(false)
                }
                setInputError(null)
              }} />
            <p className="text-xs text-muted-foreground">
              ZIP up to 9 MiB compressed, or choose a folder below. Only one source is imported.
            </p>
          </div>
          <div className="space-y-1">
            <label htmlFor="initial-owned-site-folder" className="text-sm font-medium">
              Initial folder (optional)
            </label>
            <Input id="initial-owned-site-folder" type="file" multiple ref={initialFolderInput}
              disabled={creating || loading}
              onChange={event => {
                const selected = Array.from(event.currentTarget.files ?? [])
                setInitialFolder(selected)
                if (selected.length) {
                  clearInitialZip()
                  setPublishStarter(false)
                }
                setInputError(null)
              }} />
            <p className="text-xs text-muted-foreground">
              Up to 100 files, 2 MiB each, 8 MiB total. Include index.html.
              The server validates all files before creating the stopped site.
              No automatic retry or start.
            </p>
          </div>
          {(initialZip !== null || initialFolder.length > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p role="status" className="text-xs text-muted-foreground">
                {initialZip ? "Selected ZIP: " + initialZip.name :
                  initialFolder.length === 1 ? "Selected folder: 1 file" :
                    "Selected folder: " + initialFolder.length + " files"}
              </p>
              <Button type="button" variant="outline" size="sm" disabled={creating || loading}
                onClick={() => {
                  clearInitialZip()
                  clearInitialFolder()
                  setInputError(null)
                  setNotice(null)
                }}>Clear selected import</Button>
            </div>
          )}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4"
                checked={publishStarter}
                disabled={creating || loading || initialZip !== null || initialFolder.length > 0}
                onChange={event => {
                  setPublishStarter(event.currentTarget.checked)
                  setInputError(null)
                }} />
              Publish starter HTML on creation
            </label>
            <p className="text-xs text-muted-foreground">
              Publish an editable index.html as the first stopped release, with no automatic start.
            </p>
            {publishStarter && <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="initial-owned-site-html" className="text-xs font-medium">
                  Initial HTML
                </label>
                <Button type="button" variant="outline" size="sm"
                  disabled={creating || loading}
                  onClick={() => {
                    setInitialHtml(starterHtml)
                    setInputError(null)
                  }}>
                  Reset sample HTML
                </Button>
              </div>
              <Textarea id="initial-owned-site-html" rows={9}
                className="font-mono text-xs"
                spellCheck={false}
                disabled={creating || loading}
                value={initialHtml}
                onChange={event => {
                  setInitialHtml(event.currentTarget.value)
                  setInputError(null)
                }} />
              <p className="text-xs text-muted-foreground">
                UTF-8 HTML, maximum 32 KiB. Your changes are included in the first immutable release.
              </p>
            </div>}
            {inputError && <p role="alert" className="text-destructive text-sm">{inputError}</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
