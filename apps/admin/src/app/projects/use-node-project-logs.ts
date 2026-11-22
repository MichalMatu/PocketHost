import * as React from "react"
import { api } from "./node-project-client"

type ReadJson = (url: string) => Promise<Record<string, unknown>>

/** Keep original log lines and discard responses from a superseded selection. */
export function useNodeProjectLogs(getJson: ReadJson) {
  const [logLines, setLogLines] = React.useState<string[]>([])
  const [logsLoading, setLogsLoading] = React.useState(false)
  const [logsError, setLogsError] = React.useState<string | null>(null)
  const [logsChecked, setLogsChecked] = React.useState(false)
  const generation = React.useRef(0)

  const resetLogs = React.useCallback(() => {
    generation.current += 1
    setLogLines([])
    setLogsLoading(false)
    setLogsError(null)
    setLogsChecked(false)
  }, [])

  React.useEffect(() => () => { generation.current += 1 }, [])

  const loadLogs = React.useCallback(async (id: string): Promise<boolean> => {
    const request = ++generation.current
    // Do not present logs from an earlier read as the current project snapshot.
    setLogLines([])
    setLogsLoading(true)
    setLogsError(null)
    setLogsChecked(false)
    try {
      const response = await getJson(api + "/" + id + "/logs")
      if (request !== generation.current) return false
      const logs = response.logs as { lines?: unknown } | undefined
      if (!Array.isArray(logs?.lines) || !logs.lines.every(x => typeof x === "string"))
        throw new Error("Invalid bounded service logs")
      setLogLines(logs.lines as string[])
      setLogsChecked(true)
      return true
    } catch (error) {
      if (request !== generation.current) return false
      setLogLines([])
      setLogsError("Node logs unavailable for this project. Try View logs again.")
      throw error
    } finally {
      if (request === generation.current) setLogsLoading(false)
    }
  }, [getJson])

  return { logLines, logsLoading, logsError, logsChecked, resetLogs, loadLogs }
}
