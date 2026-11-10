import * as React from "react"
import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { DashboardTooltip, historyTime, type TooltipFields } from "@/app/termux/dashboard-tooltip"

const source = { observedAt: "2026-11-10T15:22:07.000Z", timestamp: Date.parse("2026-11-10T15:22:07.000Z") }

describe("Dashboard tooltip: actual sample time and aligned units", () => {
  it("uses the observed timestamp instead of the Recharts series label", () => {
    const fields: TooltipFields = {
      internetMs: { label: "TCP handshake", unit: "ms", decimals: 1 },
    }
    render(<DashboardTooltip active range="1h" fields={fields} payload={[
      { dataKey: "internetMs", value: 120.7, payload: source },
    ]} />)
    const tooltip = screen.getByRole("tooltip")
    expect(tooltip.textContent).toContain("TCP handshake")
    expect(tooltip.textContent).toContain("120.7 ms")
    expect(tooltip.textContent).not.toContain("Time unavailable")
    expect(tooltip.textContent).not.toContain("Sample time unavailable")
    expect(tooltip.querySelector("dt")?.textContent).toContain("TCP handshake")
    expect(tooltip.querySelector("dd")?.textContent).toContain("120.7 ms")
    expect(tooltip.querySelector("dl")?.className).toContain("grid")
  })

  it("shows independent units and enough separation for both percentages", () => {
    const fields: TooltipFields = {
      batteryPercent: { label: "Battery", unit: "%", decimals: 1 },
      storageUsedPercent: { label: "Storage used", unit: "%", decimals: 1 },
    }
    render(<DashboardTooltip active range="24h" fields={fields} payload={[
      { dataKey: "batteryPercent", value: 100, payload: source },
      { dataKey: "storageUsedPercent", value: 49.7, payload: source },
    ]} />)
    const tooltip = screen.getByRole("tooltip")
    const rows = tooltip.querySelectorAll("dl > div")
    expect(rows).toHaveLength(2)
    expect(rows[0]?.className).toContain("gap-x-5")
    expect(rows[0]?.querySelector("dd")?.textContent).toBe("100%")
    expect(rows[1]?.querySelector("dd")?.textContent).toBe("49.7%")
    expect(tooltip.textContent).not.toContain("Sample time unavailable")
  })

  it("retains precise low RX/TX rates and leaves missing readings absent", () => {
    const fields: TooltipFields = {
      networkRxMbps: { label: "RX", unit: "Mb/s", decimals: 3 },
      networkTxMbps: { label: "TX", unit: "Mb/s", decimals: 3 },
    }
    render(<DashboardTooltip active range="7d" fields={fields} payload={[
      { dataKey: "networkRxMbps", value: 0.018, payload: source },
      { dataKey: "networkTxMbps", value: 0.017, payload: source },
      { dataKey: "unknown", value: null, payload: source },
    ]} />)
    expect(screen.getByRole("tooltip").textContent).toContain("0.018 Mb/s")
    expect(screen.getByRole("tooltip").textContent).toContain("0.017 Mb/s")
    expect(screen.getByRole("tooltip").querySelectorAll("dd")).toHaveLength(2)
  })

  it("does not fabricate values and keeps genuine zero", () => {
    const fields: TooltipFields = { cpu: { label: "Android CPU", unit: "%", decimals: 1 } }
    const { rerender } = render(<DashboardTooltip active range="1h" fields={fields} payload={[
      { dataKey: "cpu", value: null, payload: source },
    ]} />)
    expect(screen.queryByRole("tooltip")).toBeNull()
    rerender(<DashboardTooltip active range="1h" fields={fields} payload={[
      { dataKey: "cpu", value: 0, payload: source },
    ]} />)
    expect(screen.getByRole("tooltip").textContent).toContain("0%")
    expect(historyTime("invalid", "1h")).toBe("Time unavailable")
  })
})
