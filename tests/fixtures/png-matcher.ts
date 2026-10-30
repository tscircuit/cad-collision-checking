import { expect } from "bun:test"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { decode } from "fast-png"

expect.extend({
  toMatchPngSnapshot(received: unknown, testPath: string, name?: string) {
    if (!(received instanceof Uint8Array)) throw new Error("Expected PNG bytes")
    const directory = join(dirname(testPath), "__snapshots__")
    const filename = join(
      directory,
      `${name ?? basename(testPath).replace(/\.test\.tsx?$/, "")}.snap.png`,
    )
    const update =
      process.argv.includes("-u") || process.argv.includes("--update-snapshots")
    if (update || (!existsSync(filename) && !process.env.CI)) {
      mkdirSync(directory, { recursive: true })
      writeFileSync(filename, received)
      return { pass: true, message: () => `Wrote ${filename}` }
    }
    if (!existsSync(filename))
      return { pass: false, message: () => `Missing snapshot: ${filename}` }
    const expected = decode(readFileSync(filename))
    const actual = decode(received)
    let changed = 0
    for (let i = 0; i < actual.data.length; i++)
      if (Math.abs(actual.data[i] - expected.data[i]) > 3) changed++
    const pass =
      actual.width === expected.width &&
      actual.height === expected.height &&
      actual.channels === expected.channels &&
      changed / actual.data.length < 0.001
    if (!pass)
      writeFileSync(filename.replace(".snap.png", ".actual.png"), received)
    return {
      pass,
      message: () =>
        `PNG differs from ${filename} (${changed} channels changed)`,
    }
  },
})

declare module "bun:test" {
  interface Matchers<T = unknown> {
    toMatchPngSnapshot(testPath: string, name?: string): void
  }
}
