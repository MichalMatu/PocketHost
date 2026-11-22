import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Project } from "./node-project-client"

type ProjectChoice = Pick<Project, "id" | "name">

type Props = {
  projects: ProjectChoice[]
  selectedId: string
  busy: boolean
  onSelect: (project: ProjectChoice) => void
}

/** Presentation only; the parent retains project selection and API effects. */
export function NodeProjectPicker({ projects, selectedId, busy, onSelect }: Props) {
  return <Card>
    <CardHeader><CardTitle>Owned projects</CardTitle></CardHeader>
    <CardContent>
      {projects.length === 0
        ? <p className="text-muted-foreground text-sm">No Node projects yet.</p>
        : <div className="flex flex-wrap gap-2">{projects.map(project =>
          <Button key={project.id} variant={selectedId === project.id ? "default" : "outline"}
            disabled={busy} onClick={() => onSelect(project)}>{project.name}</Button>)}</div>}
    </CardContent>
  </Card>
}
