import { expect, test } from "bun:test"
import { build } from "esbuild"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

test("a standalone Node bundle checks collisions without node_modules, network or adjacent WASM", async () => {
  const directory = await mkdtemp(join(tmpdir(), "collision-runtime-"))
  try {
    const filename = join(directory, "collision.mjs")
    const { metafile } = await build({
      stdin: {
        contents: `
          import { checkBundledCollisionRuntime } from "./tests/fixtures/runtime-smoke"
          globalThis.fetch = () => { throw new Error("Unexpected runtime download") }
          console.log(JSON.stringify(await checkBundledCollisionRuntime()))
        `,
        resolveDir: resolve(import.meta.dir, ".."),
        loader: "ts",
      },
      platform: "node",
      format: "esm",
      bundle: true,
      metafile: true,
      outfile: filename,
    })
    expect(
      Object.keys(metafile!.inputs).some((p) =>
        /node_modules\/manifold-3d\//.test(p),
      ),
    ).toBe(false)
    expect(await readdir(directory)).toEqual(["collision.mjs"])
    const process = Bun.spawnSync(["node", filename], { cwd: directory })
    expect(process.exitCode, process.stderr.toString()).toBe(0)
    expect(JSON.parse(process.stdout.toString())).toEqual({
      shared: true,
      volume: expect.closeTo(0.04, 6),
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 30000)
