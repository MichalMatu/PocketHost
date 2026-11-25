import { examplePackage, exampleLock } from "./node-project-client"

export const jsonApiStarter = {
  manifest: examplePackage,
  lockfile: exampleLock,
  source: [
    "import http from 'node:http'",
    "const port = Number(process.env.PORT)",
    "if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Assigned PORT required')",
    "http.createServer((request, response) => {",
    "  if (request.url === '/__pockethost/ready') {",
    "    response.setHeader('X-PocketHost-Ready', process.env.POCKETHOST_READINESS_NONCE ?? '')",
    "    response.end('ready')",
    "    return",
    "  }",
    "  response.setHeader('Content-Type', 'application/json; charset=utf-8')",
    "  if (request.method === 'GET' && request.url === '/api/status') {",
    "    response.end(JSON.stringify({ status: 'ok' }))",
    "  } else {",
    "    response.statusCode = 404",
    "    response.end(JSON.stringify({ error: 'not-found' }))",
    "  }",
    "}).listen(port, '127.0.0.1')",
  ].join("\n"),
}
