#!/usr/bin/env node
// Read-only PocketHost Test Lab: private Chrome captures and allowlisted GET status probes.
import { mkdir, writeFile, chmod } from "node:fs/promises"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const routes = {
  dashboard: "/dashboard", hosting: "/hosting", sites: "/sites",
  projects: "/projects", deployments: "/deployments", logs: "/runtime-logs",
  services: "/services", agent: "/local-agent", network: "/settings/network",
}
const apis = {
  host: "/api/v1/host/snapshot", network: "/api/v1/network-access",
  sites: "/api/v1/sites", projects: "/api/v1/node-projects",
}
const screens = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
]

function options(argv) {
  const args = Object.create(null)
  for (const input of argv) {
    const match = /^--(base|sha|routes|api)=(.+)$/.exec(input)
    if (!match || Object.hasOwn(args, match[1])) throw Error("Invalid argument")
    args[match[1]] = match[2]
  }
  if (!/^[0-9a-f]{40}$/.test(args.sha || "")) throw Error("Exact approved SHA required")
  let base
  try { base = new URL(args.base) } catch { throw Error("Invalid base URL") }
  if (base.protocol !== "http:" || base.username || base.password ||
      base.pathname !== "/" || base.hash || base.search) throw Error("Only bare HTTP LAN origin allowed")
  const host = base.hostname, numbers = host.split(".")
  const ipv4 = numbers.length === 4 && numbers.every(n => /^\d{1,3}$/.test(n) && Number(n) <= 255)
  const n = numbers.map(Number)
  const privateHost = host === "localhost" || (ipv4 &&
    (n[0] === 127 || n[0] === 10 || (n[0] === 192 && n[1] === 168) ||
      (n[0] === 172 && n[1] >= 16 && n[1] <= 31)))
  if (!privateHost) throw Error("Public origin denied")
  const select = (raw, allowed) => {
    const list = raw.split(",")
    if (list.length > 12 || new Set(list).size !== list.length ||
        list.some(name => !Object.hasOwn(allowed, name))) throw Error("Selection not allowlisted")
    return list
  }
  return { origin: base.origin, sha: args.sha,
    pages: select(args.routes || "dashboard,hosting,projects", routes),
    probes: args.api ? select(args.api, apis) : [] }
}

const escapeHtml = text => String(text).replace(/[&<>"']/g,
  ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch])

async function geometry(page) {
  return page.evaluate(() => {
    const w = window.innerWidth
    let outside = 0, smallControls = 0
    for (const node of Array.from(document.querySelectorAll("body *")).slice(0, 5000)) {
      const r = node.getBoundingClientRect()
      if (r.height <= 0 || r.width <= 0) continue
      if (r.left < -2 || r.right > w + 2) outside++
      if (node.matches("a,button,input,select,textarea,[role='button']") &&
          (r.width < 32 || r.height < 32)) smallControls++
    }
    return { horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - w),
      outOfBoundsElements: outside, smallControls }
  })
}

async function probe(request, origin, name) {
  const start = Date.now()
  try {
    const response = await request.get(origin + apis[name],
      { timeout: 8000, maxRedirects: 0, headers: { Accept: "application/json" } })
    return { name, status: response.status(), ms: Date.now() - start }
  } catch { return { name, status: null, ms: Date.now() - start, error: "GET unavailable" } }
}

function gallery(report) {
  const cards = report.captures.map(c => {
    const label = c.route + " · " + c.viewport
    const stats = "HTTP " + c.status + ", overflow " +
      (c.geometry?.horizontalOverflow ?? "?") + "px, JS errors " + c.jsErrors
    return "<article><h2>" + escapeHtml(label) + "</h2><p>" + escapeHtml(stats) +
      "</p>" + (c.file ? '<a href="' + escapeHtml(c.file) +
        '"><img src="' + escapeHtml(c.file) + '" loading="lazy"/></a>' : "") + "</article>"
  }).join("\n")
  return '<!doctype html><html lang="en"><meta charset="utf-8"><title>PocketHost Test Lab</title>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font:15px system-ui;background:#101827;color:#f1f5f9;margin:24px}' +
    'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px}' +
    'article{padding:16px;background:#263344;border-radius:12px;min-width:0}' +
    'img{max-width:100%;border:1px solid #789}p{color:#cbd5e1}</style>' +
    '<h1>PocketHost Test Lab — local only</h1><main>' + cards + '</main></html>'
}

async function main() {
  const config = options(process.argv.slice(2))
  let chromium
  try { ({ chromium } = await import("playwright-core")) }
  catch { throw Error("Browser dependency not installed") }
  const chrome = process.env.POCKETHOST_LAB_CHROME ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  const folder = join(repo, ".test-lab", Date.now().toString() + "-" + config.sha.slice(0, 8))
  await mkdir(folder, { recursive: true, mode: 0o700 })
  await chmod(folder, 0o700)
  const browser = await chromium.launch({ executablePath: chrome, headless: true })
  const captures = [], api = []
  try {
    // One isolated context per run: reuse compiled module/cache state across sizes
    // instead of making the A8 DEV server reload the bundle for every viewport.
    const ctx = await browser.newContext({
      viewport: { width: screens[0].width, height: screens[0].height },
      deviceScaleFactor: 1, serviceWorkers: "block", acceptDownloads: false,
    })
    await ctx.route("**/*", route => {
        // Enforce read-only traffic even if application code attempts a mutation on mount.
        // No POST/PUT/PATCH/DELETE, WebSocket or cross-origin calls from this lab context.
        const request = route.request()
        if (!["GET", "HEAD"].includes(request.method())) return route.abort()
        const address = request.url()
        if (address.startsWith("data:") || address.startsWith("blob:")) return route.continue()
        let u
        try { u = new URL(address) } catch { return route.abort() }
        return u.origin === config.origin ? route.continue() : route.abort()
    })
    for (const vp of screens) {
      for (const route of config.pages) {
        const page = await ctx.newPage()
        await page.setViewportSize({ width: vp.width, height: vp.height })
        let jsErrors = 0, consoleErrors = 0
        page.on("pageerror", () => { jsErrors++ })
        page.on("console", e => { if (e.type() === "error") consoleErrors++ })
        const cap = { route, viewport: vp.name, status: null, geometry: null,
          jsErrors: 0, consoleErrors: 0, file: null, rendered: false, stage: "navigation" }
        try {
          // The remote Vite module graph can exceed a DOMContentLoaded deadline on Wi-Fi.
          // Commit captures HTTP without equating it with fully rendered React content.
          const response = await page.goto(config.origin + routes[route],
            { waitUntil: "commit", timeout: 18000 })
          cap.status = response?.status() ?? null
          cap.stage = "render"
          try {
            await page.waitForFunction(() =>
              (document.querySelector("#root")?.textContent?.trim().length ?? 0) > 20,
              null, { timeout: 10000 })
            cap.rendered = true
          } catch {
            // Preserve screenshots of unloaded/error states for diagnosis.
            cap.rendered = false
          }
          await page.waitForTimeout(700)
          cap.geometry = await geometry(page)
          cap.stage = "screenshot"
          const file = route + "-" + vp.name + ".png"
          const filename = join(folder, file)
          await page.screenshot({ path: filename, animations: "disabled", timeout: 12000 })
          await chmod(filename, 0o600)
          cap.file = file
          cap.stage = "complete"
          if (!cap.rendered) cap.error = "React content not confirmed"
        } catch {
          cap.error = cap.stage === "navigation" ? "Navigation unavailable" :
            cap.stage === "render" ? "Layout inspection unavailable" : "Screenshot unavailable"
        }
        cap.jsErrors = jsErrors
        cap.consoleErrors = consoleErrors
        captures.push(cap)
        await page.close()
      }
    }
    for (const name of config.probes) api.push(await probe(ctx.request, config.origin, name))
    await ctx.close()
  } finally { await browser.close() }
  const report = { kind: "PocketHostTestLab", sourceSha: config.sha,
    origin: config.origin, mode: "read-only", at: new Date().toISOString(), captures, api }
  const reportName = join(folder, "report.json"), galleryName = join(folder, "index.html")
  await writeFile(reportName, JSON.stringify(report, null, 2), { mode: 0o600 })
  await writeFile(galleryName, gallery(report), { mode: 0o600 })
  await chmod(reportName, 0o600)
  await chmod(galleryName, 0o600)
  process.stdout.write(JSON.stringify({ kind: report.kind, status: "OBSERVED",
    sourceSha: config.sha, readOnly: true, screenshots: captures.length,
    failures: captures.filter(c => c.error).length,
    notRendered: captures.filter(c => !c.rendered).length,
    overflowing: captures.filter(c => c.rendered && (c.geometry?.horizontalOverflow || 0) > 0).length,
    overflowCases: captures.filter(c => (c.geometry?.horizontalOverflow || 0) > 0).length,
    jsErrors: captures.reduce((sum, c) => sum + c.jsErrors, 0),
    api, localFolder: folder }) + "\n")
}
main().catch(() => {
  // Never publish browser console, response body, credentials or raw error stack to Git.
  process.stderr.write("PocketHost Test Lab: configuration, Chrome or filesystem unavailable\n")
  process.exitCode = 1
})
