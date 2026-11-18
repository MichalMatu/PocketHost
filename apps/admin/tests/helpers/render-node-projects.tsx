import * as React from "react"
import { render } from "@testing-library/react"
import { afterEach } from "vitest"

const observers: MutationObserver[] = []
afterEach(() => { observers.forEach(observer => observer.disconnect()); observers.length = 0 })

/** Keep legacy action tests focused on behavior while production starts collapsed. */
export function renderNodeProjects(ui: React.ReactElement) {
  const view = render(ui)
  const expand = () => {
    view.container.querySelectorAll<HTMLDetailsElement>('details[data-testid^="node-"]')
      .forEach(section => { section.open = true })
  }
  const observer = new MutationObserver(expand)
  observer.observe(view.container, { childList: true, subtree: true })
  observers.push(observer)
  expand()
  return view
}
