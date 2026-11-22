import { expect, it } from "vitest"

it("exposes browser File binary and text readers in jsdom", async () => {
  const binary = new File([new Uint8Array([0, 127, 255])], "fixture.bin")
  expect([...new Uint8Array(await binary.arrayBuffer())]).toEqual([0, 127, 255])
  const html = new File(["<h1>Fixture</h1>"], "index.html")
  expect(await html.text()).toBe("<h1>Fixture</h1>")
})
