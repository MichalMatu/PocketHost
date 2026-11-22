import * as React from "react"
import { api } from "./node-project-client"

type ReadJson = (url: string) => Promise<Record<string, unknown>>

/** Invalidate delayed read-only replies when a different Node project is selected. */
export function useNodeProjectScopedRead(getJson: ReadJson) {
  const generation = React.useRef(0)
  const invalidateRead = React.useCallback(() => { generation.current += 1 }, [])
  React.useEffect(() => () => { generation.current += 1 }, [])

  const readScoped = React.useCallback(async (
    id: string, operation: "health" | "preview",
  ): Promise<Record<string, unknown> | null> => {
    const selectedGeneration = generation.current
    try {
      const result = await getJson(api + "/" + id + "/" + operation)
      return selectedGeneration === generation.current ? result : null
    } catch (cause) {
      if (selectedGeneration === generation.current) throw cause
      return null
    }
  }, [getJson])

  return { invalidateRead, readScoped }
}
