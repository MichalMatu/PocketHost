import { nodeOwnerAccess } from "../../../src/modules/host/node-owner-access.ts"
import { createSqliteReadApi } from "./node-sqlite-api.ts"
import { readNodeTraffic } from "../../../src/modules/host/traffic-runtime.ts"
import { NodeProjectHost } from "../../../src/modules/host/node-project-host.ts"
import { previewPublicGitHubNodeSource } from "../../../src/modules/host/node-github-source.ts"
import { NodeRunitHost } from "../../../src/modules/host/node-runit-host.ts"
import { NodeDependencyPreparer } from "../../../src/modules/host/node-dependency-preparer.ts"
import { NodeBuildPreparer } from "../../../src/modules/host/node-build-preparer.ts"
import { NodeProjectBackupHost } from "../../../src/modules/host/node-project-backup-host.ts"
import { NodeProjectDataScope, reviewNodeDataOfflinePrerequisites } from "../../../src/modules/host/node-project-data-scope.ts"
import { NodeProjectDataSnapshots } from "../../../src/modules/host/node-project-data-snapshot.ts"
import { reportDashboardOwnedEvent } from "../../../src/modules/host/dashboard-telemetry-history.ts"
import path from "path"
import os from "node:os"
import type { IncomingMessage } from "node:http"
import type { Plugin } from "vite"

/** Server-only Node hosting; LAN mutation requires an owner-held secret. */
export function nodeProjectApi(roots?: { serviceRoot: string; logRoot: string }): Plugin {
  const hosts = new Set(["127.0.0.1:8787", "localhost:8787"])
  const origins = new Set(["http://127.0.0.1:8787", "http://localhost:8787"])
  async function readJson(request: IncomingMessage, limit: number): Promise<unknown> {
    if (request.headers["content-encoding"]) throw new RangeError("Compressed payload refused")
    const claimed = request.headers["content-length"]
    if (claimed && (!/^\d+$/.test(claimed) || Number(claimed) > limit)) throw new RangeError("Payload too large")
    request.setTimeout(20000, () => request.destroy())
    const chunks: Buffer[] = []
    let total = 0
    try {
      for await (const chunk of request) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        total += bytes.length
        if (total > limit) throw new RangeError("Payload too large")
        chunks.push(bytes)
      }
      return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
    } finally {
      // Request-body inactivity is limited to 20s, but the same TCP socket
      // must survive a separately approved, bounded npm/build operation.
      request.setTimeout(0)
    }
  }
  return {
    name: "pockethost-owned-node-projects-dev",
    apply: "serve",
    configureServer(server) {
      const enabled = process.env.POCKETHOST_ENABLE_OWNED_SITE_DEV === "1" &&
        process.env.POCKETHOST_ENABLE_NODE_HOSTING_DEV === "1"
      const host = enabled ? new NodeProjectHost() : null
      const runtime = enabled ? new NodeRunitHost(undefined, roots?.serviceRoot, roots?.logRoot) : null
      const nodeBackup = enabled ? new NodeProjectBackupHost() : null
      const nodeData = enabled ? new NodeProjectDataScope() : null
      const dataSnapshots = enabled ? new NodeProjectDataSnapshots() : null
      const sqlite = nodeData && createSqliteReadApi(nodeData, id => runtime!.status(id))
      const executionEnabled = process.env.POCKETHOST_ENABLE_NODE_RUNTIME_DEV === "1"
      const dependencyInstallEnabled = process.env.POCKETHOST_ENABLE_NODE_DEPENDENCIES_DEV === "1"
      const buildEnabled = process.env.POCKETHOST_ENABLE_NODE_BUILD_DEV === "1"
      const releaseInUse = (projectId: string, releaseId: string): boolean => {
        const current = runtime!.status(projectId)
        return current.state === "unknown" ||
          [current.activeRelease, current.lastGoodRelease, current.previousGoodRelease]
            .includes(releaseId)
      }
      const nodeRoot = path.join(os.homedir(), "PocketHost-NodeProjects")
      const preparer = enabled ? new NodeDependencyPreparer(
        host!, nodeRoot, releaseInUse,
      ) : null
      const builder = enabled ? new NodeBuildPreparer(
        host!, nodeRoot, releaseInUse,
      ) : null
      const buildReview = (projectId: string) => {
        const review = runtime!.reviewDependencySetup(projectId)
        const { plan } = host!.release(projectId, review.release)
        const buildRequired = plan.commands.build !== null
        let dependenciesPrepared = plan.dependencyCount === 0
        if (!dependenciesPrepared) {
          try { preparer!.verifyPrepared(projectId, review.release); dependenciesPrepared = true }
          catch { /* A missing or changed tree never receives approval. */ }
        }
        let artifactVerified = false
        let artifact: { entries: number; bytes: number; files: string[]; truncated: boolean } | null = null
        if (buildRequired) {
          try {
            const result = builder!.inspectBuilt(projectId, review.release)
            artifact = {
              entries: result.entries, bytes: result.bytes,
              files: result.files, truncated: result.truncated,
            }
            artifactVerified = true
          } catch { /* No verified output yet. */ }
        }
        const blockers = [...review.blockers]
        if (releaseInUse(projectId, review.release)) blockers.push("release-in-use")
        const status = !buildRequired ? "not-required" :
          blockers.length ? "blocked" :
          artifactVerified ? "verified" :
          dependenciesPrepared ? "ready-to-build" : "requires-dependencies"
        return {
          release: review.release, status, buildRequired,
          script: buildRequired ? builder!.buildScript(projectId, review.release) : null,
          dependencyCount: plan.dependencyCount, dependenciesPrepared,
          artifactVerified, artifact, blockers,
        }
      }
      const reviewData = (id: string) => {
        const data = nodeData!.inspect(id)
        const recovery = reviewNodeDataOfflinePrerequisites(data, runtime!.status(id))
        return { data, recovery }
      }
      const backupEnabled = process.env.POCKETHOST_ENABLE_NODE_BACKUPS_DEV === "1"
      const access = nodeOwnerAccess(process.env.POCKETHOST_NODE_ACCESS_MODE,
        process.env.POCKETHOST_NODE_OWNER_TOKEN ?? "")
      const ownerAuthorized = (request: IncomingMessage) =>
        access.authorized(request.headers["x-pockethost-node-owner"])
      let pending: Promise<void> = Promise.resolve()
      function serial<T>(fn: () => T): Promise<T> {
        const action = pending.then(fn, fn)
        pending = action.then(() => undefined, () => undefined)
        return action
      }
      server.middlewares.use("/api/v1/node-projects", async (request, response) => {
        response.setHeader("Cache-Control", "no-store")
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("Content-Security-Policy", "default-src 'none'")
        response.setHeader("Content-Type", "application/json; charset=utf-8")
        const origin = request.headers.origin
        const remote = request.socket.remoteAddress
        if (!hosts.has(request.headers.host ?? "") ||
            (origin && !origins.has(origin)) ||
            request.headers["sec-fetch-site"] === "cross-site" ||
            (remote !== "127.0.0.1" && remote !== "::ffff:127.0.0.1")) {
          response.statusCode = 403
          response.end('{"error":"forbidden"}')
          return
        }
        if (!host) {
          response.statusCode = 404
          response.end('{"error":"node-projects-disabled"}')
          return
        }
        if (sqlite && await sqlite(request, response, ownerAuthorized(request))) return
        const route = request.url?.split("?")[0] ?? ""
        const match = /^\/(node-[a-f0-9]{32})(?:\/(releases|stage|restore-candidate|remove|runtime|plan|logs|deploy|start|stop|restart|rollback|check-build|preview|source|health|dependency-review|install-dependencies|build-review|build|rollback-preview|data-scope|data-snapshots|traffic))?$/.exec(route)
        const snapshotVerify = /^\/(node-[a-f0-9]{32})\/data-snapshots\/(snapshot-[a-f0-9]{32})\/verify$/.exec(route)
        const id = match?.[1] ?? snapshotVerify?.[1]
        const op = match?.[2] ?? (snapshotVerify ? "verify-snapshot" : undefined)
        if (request.method === "GET" &&
            (route === "/backup/snapshots" || op === "data-scope" ||
              op === "data-snapshots" || op === "verify-snapshot" ||
              op === "preview" || op === "source" ||
              op === "dependency-review" ||
             op === "build-review" || op === "rollback-preview") &&
            !ownerAuthorized(request)) {
          response.statusCode = 403
          response.end('{"error":"node-owner-required"}')
          return
        }
        if (request.method === "GET") {
          try {
            const data = route === "/owner-session" ?
              { configured: access.configured, authorized: ownerAuthorized(request), mode: access.mode } :
              route === "/" ? { projects: host.list(), accessMode: access.mode } :
              route === "/toolchain" ? { toolchain: runtime!.toolVersions() } :
              route === "/registry" ? { registries: runtime!.registryProjection() } :
              route === "/backup" ? { backup: nodeBackup!.status(), backupsEnabled: backupEnabled } :
              route === "/backup/snapshots" ? {
                snapshots: (await nodeBackup!.snapshots()).map(({ id, time }) => ({ id, time })),
              } :
              id && !op ? { project: host.inspect(id) } :
              id && op === "traffic" ? readNodeTraffic(runtime!, id, request.url) :
              id && op === "releases" ? { releases: host.candidates(id) } :
              id && op === "data-scope" ? reviewData(id) :
              id && op === "data-snapshots" ? {
                snapshots: dataSnapshots!.listSnapshots(id),
                verification: "metadata-only",
                snapshotCreationEnabled: false,
              } :
              id && op === "verify-snapshot" && snapshotVerify ? {
                verification: dataSnapshots!.verifySnapshot(id, snapshotVerify[2]!),
              } :
              id && op === "runtime" ? { runtime: runtime!.status(id), executionEnabled } :
              id && op === "plan" ? { plan: runtime!.preview(id), executionEnabled } :
              id && op === "dependency-review" ? {
                review: runtime!.reviewDependencySetup(id), dependencyInstallEnabled,
              } :
              id && op === "build-review" ? {
                review: buildReview(id), buildEnabled,
              } :
              id && op === "rollback-preview" ? {
                rollbackPreview: runtime!.rollbackPreview(id),
              } :
              id && op === "logs" ? { logs: runtime!.logs(id) } :
              id && op === "preview" ? { preview: await runtime!.previewLocalResponse(id) } :
              id && op === "source" ? { source: host.candidateSource(id) } :
              id && op === "health" ? { health: await runtime!.health(id) } : null
            if (!data) response.statusCode = 404
            else response.statusCode = 200
            response.end(JSON.stringify(data ?? { error: "not-found" }))
          } catch {
            response.statusCode = 409
            response.end('{"error":"node-project-state-unavailable"}')
          }
          return
        }
        const create = request.method === "POST" && route === "/"
        const githubPreview = request.method === "POST" && route === "/github/preview"
        const stage = request.method === "POST" && !!id && op === "stage"
        const restore = request.method === "POST" && !!id && op === "restore-candidate"
        const remove = request.method === "POST" && !!id && op === "remove"
        const deploy = request.method === "POST" && !!id && op === "deploy"
        const start = request.method === "POST" && !!id && op === "start"
        const stop = request.method === "POST" && !!id && op === "stop"
        const restart = request.method === "POST" && !!id && op === "restart"
        const rollback = request.method === "POST" && !!id && op === "rollback"
        const checkBuild = request.method === "POST" && !!id && op === "check-build"
        const installDependencies = request.method === "POST" && !!id && op === "install-dependencies"
        const executeBuild = request.method === "POST" && !!id && op === "build"
        const createBackup = request.method === "POST" && route === "/backup/create"
        const restoreBackup = request.method === "POST" && route === "/backup/restore"
        if (!create && !githubPreview && !stage && !restore && !remove && !deploy && !start && !stop &&
            !restart && !rollback && !checkBuild && !installDependencies && !executeBuild &&
            !createBackup && !restoreBackup) {
          response.statusCode = 404
          response.end('{"error":"not-found"}')
          return
        }
        if (!origin || !origins.has(origin) ||
            request.headers["x-pockethost-intent"] !== "owned-node-project" ||
            !ownerAuthorized(request)) {
          response.statusCode = 403
          response.end('{"error":"mutation-not-authorized"}')
          return
        }
        try {
          if (githubPreview) {
            const body = await readJson(request, 512)
            if (!body || typeof body !== "object" || Array.isArray(body) ||
                Object.keys(body).join(",") !== "repository") {
              throw new RangeError("Invalid GitHub source preview request")
            }
            const preview = await previewPublicGitHubNodeSource(
              (body as { repository: unknown }).repository,
            )
            response.statusCode = 200
            response.end(JSON.stringify({ preview }))
            return
          }
          const result = await serial(async () => {
            if (createBackup || restoreBackup) {
              if (!backupEnabled) throw new Error("Node backup mutations disabled")
              const requestBody = await readJson(request, 1024)
              if (!requestBody || typeof requestBody !== "object" || Array.isArray(requestBody))
                throw new RangeError("Invalid backup authorization")
              const input = requestBody as Record<string, unknown>
              if (createBackup) {
                if (Object.keys(input).join(",") !== "approved" || input.approved !== true)
                  throw new RangeError("Explicit scoped backup authorization required")
                const previous = nodeBackup!.status().initialized
                  ? await nodeBackup!.snapshots() : []
                await nodeBackup!.backup(true)
                // Verify one new owned snapshot; repository initialization is not
                // evidence that this specific backup completed.
                const observed = await nodeBackup!.snapshots()
                const added = observed.filter((item) =>
                  !previous.some((old) => old.id === item.id))
                if (added.length !== 1) throw new Error("New Node snapshot not confirmed")
                return { backupCreated: true, snapshot: added[0]!.id,
                  backup: nodeBackup!.status() }
              }
              if (Object.keys(input).sort().join(",") !== "approved,snapshot" ||
                  input.approved !== true || typeof input.snapshot !== "string" ||
                  !/^[a-f0-9]{64}$/.test(input.snapshot))
                throw new RangeError("Explicit snapshot restore authorization required")
              const result = await nodeBackup!.restoreToStaging(input.snapshot, true)
              // Return a count, never the private Android filesystem path.
              return { restoredToStaging: true, verifiedProjects: result.verifiedProjects }
            }
            if (installDependencies) {
              if (!dependencyInstallEnabled) throw new Error("Node dependency installation disabled")
              const input = await readJson(request, 1024)
              if (!input || typeof input !== "object" || Array.isArray(input))
                throw new RangeError("Invalid dependency installation approval")
              const body = input as Record<string, unknown>
              if (Object.keys(body).sort().join(",") !== "approved,release" ||
                  body.approved !== true || typeof body.release !== "string" ||
                  !/^r-[a-f0-9]{32}$/.test(body.release))
                throw new RangeError("Explicit pinned dependency installation approval required")
              const review = runtime!.reviewDependencySetup(id!)
              if (review.release !== body.release || review.status !== "review-required" ||
                  !review.installRequired || review.blockers.length > 0)
                throw new Error("Dependency plan blocked or changed before installation")
              const prepared = await preparer!.prepare(id!, body.release, true)
              const verified = preparer!.verifyPrepared(id!, body.release)
              if (verified.release !== prepared.release ||
                  verified.dependencyCount !== prepared.dependencyCount)
                throw new Error("Published Node dependency integrity mismatch")
              return { dependencies: { ...prepared, verified: true } }
            }
            if (executeBuild) {
              if (!buildEnabled) throw new Error("Node build execution disabled")
              const input = await readJson(request, 1024)
              if (!input || typeof input !== "object" || Array.isArray(input))
                throw new RangeError("Invalid build approval")
              const body = input as Record<string, unknown>
              if (Object.keys(body).sort().join(",") !== "approved,release" ||
                  body.approved !== true || typeof body.release !== "string" ||
                  !/^r-[a-f0-9]{32}$/.test(body.release))
                throw new RangeError("Explicit pinned Node build approval required")
              const review = buildReview(id!)
              if (review.release !== body.release || review.status !== "ready-to-build" ||
                  !review.buildRequired || !review.dependenciesPrepared)
                throw new Error("Node build plan changed or is not ready")
              const published = await builder!.prepare(id!, body.release, true)
              const verified = builder!.verifyBuilt(id!, body.release)
              if (verified.release !== published.release ||
                  verified.entries !== published.entries || verified.bytes !== published.bytes)
                throw new Error("Node build artifact integrity mismatch")
              return { build: { ...published, verified: true } }
            }
            if (checkBuild) {
              const input = await readJson(request, 1024)
              if (!input || typeof input !== "object" || Array.isArray(input) ||
                  Object.keys(input).join(",") !== "release" ||
                  typeof (input as Record<string, unknown>).release !== "string")
                throw new RangeError("Invalid source syntax check")
              return { buildCheck: runtime!.checkBuild(
                id!, (input as { release: string }).release,
              ) }
            }
            if (deploy || start || stop || restart || rollback) {
              if (!executionEnabled) throw new Error("Node runtime activation disabled")
              const requestBody = await readJson(request, 1024)
              if (!requestBody || typeof requestBody !== "object" || Array.isArray(requestBody))
                throw new RangeError("Invalid runtime approval")
              const body = requestBody as Record<string, unknown>
              if (deploy) {
                if (Object.keys(body).sort().join(",") !== "approved,release" ||
                    body.approved !== true || typeof body.release !== "string")
                  throw new RangeError("Missing explicit release approval")
                return { runtime: await runtime!.deploy(id!, body.release, true) }
              }
              if (Object.keys(body).join(",") !== "approved" || body.approved !== true)
                throw new RangeError("Missing explicit runtime approval")
              return { runtime: rollback ? await runtime!.rollback(id!, true) :
                restart ? await runtime!.restart(id!, true) :
                start ? await runtime!.start(id!, true) : await runtime!.stop(id!, true) }
            }
            if (remove) {
              const body = await readJson(request, 1024)
              return runtime!.removeProject(id!, body)
            }
            if (restore) {
              const input = await readJson(request, 1024)
              if (!input || typeof input !== "object" || Array.isArray(input) ||
                  Object.keys(input).sort().join(",") !== "expectedCandidate,expectedRevision")
                throw new RangeError("Invalid candidate restore revision")
              const body = input as Record<string, unknown>
              if (typeof body.expectedCandidate !== "string" ||
                  !/^r-[a-f0-9]{32}$/.test(body.expectedCandidate) ||
                  !Number.isSafeInteger(body.expectedRevision) ||
                  (body.expectedRevision as number) < 1 ||
                  (body.expectedRevision as number) > 30)
                throw new RangeError("Invalid candidate restore revision")
              return { project: host.restoreCandidate(
                id!, body.expectedCandidate, body.expectedRevision as number,
              ) }
            }
            const input = await readJson(request, stage ? 1200 * 1024 : 1024)
            if (create) {
              if (!input || typeof input !== "object" || Array.isArray(input) ||
                  Object.keys(input).join(",") !== "name") throw new RangeError("Invalid project")
              return { project: host.create((input as { name: unknown }).name) }
            }
            if (!input || typeof input !== "object" || Array.isArray(input)) {
              throw new RangeError("Invalid staged Node source")
            }
            const body = input as Record<string, unknown>
            if (![
                  "expectedCandidate,expectedRevision,packageJson,packageLock,serverSource",
                  "expectedCandidate,expectedRevision,extraFiles,packageJson,packageLock,serverSource",
                  "assetFiles,expectedCandidate,expectedRevision,packageJson,packageLock,serverSource",
                  "assetFiles,expectedCandidate,expectedRevision,extraFiles,packageJson,packageLock,serverSource",
                ].includes(Object.keys(body).sort().join(",")) ||
                (body.expectedCandidate !== null &&
                 (typeof body.expectedCandidate !== "string" ||
                  !/^r-[a-f0-9]{32}$/.test(body.expectedCandidate))) ||
                !Number.isSafeInteger(body.expectedRevision) ||
                (body.expectedRevision as number) < 0 ||
                (body.expectedRevision as number) > 30) {
              throw new RangeError("Invalid Node source revision")
            }
            return host.stage(id!, {
              packageJson: body.packageJson,
              packageLock: body.packageLock,
              serverSource: body.serverSource,
              ...(body.extraFiles === undefined ? {} : { extraFiles: body.extraFiles }),
              ...(body.assetFiles === undefined ? {} : { assetFiles: body.assetFiles }),
            }, body.expectedCandidate as string | null, body.expectedRevision as number)
          })
          if (createBackup) reportDashboardOwnedEvent("owned-backup-created")
          if (restoreBackup) reportDashboardOwnedEvent("owned-backup-restored")
          if (deploy) reportDashboardOwnedEvent("owned-release-published")
          if (rollback) reportDashboardOwnedEvent("owned-release-rolled-back")
          response.statusCode = create ? 201 : 200
          response.end(JSON.stringify(result))
        } catch (error) {
          response.statusCode = error instanceof RangeError || error instanceof SyntaxError ? 400 : 409
          response.end(JSON.stringify({ error: response.statusCode === 400 ?
            "invalid-node-project-input" : "node-project-operation-refused" }))
        }
      })
    },
  }
}

