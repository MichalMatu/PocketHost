import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import type { Project } from "./node-project-client"

type ProjectChoice = Pick<Project, "id" | "name"> & Partial<Pick<Project, "candidateRelease">>

type Props = {
  projects: ProjectChoice[]
  selectedId: string
  busy: boolean
  onSelect: (project: ProjectChoice) => void
}

/** Presentation only; the parent retains project selection and API effects. */
export function NodeProjectPicker({ projects, selectedId, busy, onSelect }: Props) {
  return <section aria-label="Owned projects" className="divide-y rounded-lg border">
      {projects.length === 0
        ? <p className="p-4 text-muted-foreground text-sm">No Node projects yet.</p>
        : <div className="divide-y">{projects.map(project =>
          <Button key={project.id} variant="ghost" className="min-h-12 w-full justify-between rounded-none px-4"
            aria-pressed={selectedId === project.id}
            disabled={busy} onClick={() => onSelect(project)} aria-label={project.name}><span>{project.name}</span><span className="ml-auto text-xs text-muted-foreground">{project.candidateRelease ? "Source ready" : "No source"}</span><ChevronRight aria-hidden="true" /></Button>)}</div>}
  </section>
}
