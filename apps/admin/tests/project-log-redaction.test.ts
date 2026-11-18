import { describe, expect, it } from "vitest"
import { redactProjectLog } from "@/lib/hosting-observability-client"

describe("Project log secret redaction", () => {
  it.each([
    'refresh_token=private-value',
    'client_secret: private-value',
    'db_password=private-value',
    'session_cookie=private-value',
    '{"access_token":"private-value"}',
    '{"clientSecret":"private-value"}',
    'refreshToken: private-value',
    'dbPassword: private-value',
    'someApiKey: private-value',
    'Authorization: Bearer private-value',
    'Set-Cookie: session=private-value',
    'api-key=private-value',
    'password=private-value',
    'Bearer private-value',
    '-----BEGIN RSA PRIVATE KEY-----',
    'eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJwcml2YXRlIn0.abc123',
  ])("hides the complete sensitive line for %s", line => {
    expect(redactProjectLog(line)).toBe("[sensitive log line hidden]")
  })

  it.each([
    "static published",
    "node started",
    "tokenizer initialized",
    "passwordless login disabled",
    "request completed",
    "http 200",
  ])("preserves nonsensitive output %s", line => {
    expect(redactProjectLog(line)).toBe(line)
  })

  it("strips control characters and bounds displayed output", () => {
    expect(redactProjectLog("ok\nnext\r")).toBe("oknext")
    expect(redactProjectLog("x".repeat(300))).toHaveLength(240)
  })
})
