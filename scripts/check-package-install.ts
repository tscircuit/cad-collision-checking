import assert from "node:assert/strict"
import { build } from "esbuild"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

// Model core/eval: the consuming project supplies concrete development versions
// for peers, plus root overrides for Bun. Install outside the checkout so the
// existing workspace cannot hide missing peer declarations or resolution errors.
const root = resolve(import.meta.dir, "..")
const directory = await mkdtemp(join(tmpdir(), "collision-package-"))
const run = async (command: string[], cwd: string) => {
  const child = Bun.spawn(command, {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  })
  assert.equal(await child.exited, 0, command.join(" "))
}
try {
  const packDirectory = join(directory, "pack")
  const consumerDirectory = join(directory, "consumer")
  await mkdir(packDirectory)
  await mkdir(consumerDirectory)
  const manifest = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  )
  assert.equal(manifest.dependencies, undefined)
  const peerVersions: Record<string, string> = {}
  for (const [name, range] of Object.entries(manifest.peerDependencies)) {
    if (name !== "typescript") assert.equal(range, "*")
    assert(
      manifest.devDependencies[name],
      `Missing development version for ${name}`,
    )
    peerVersions[name] = manifest.devDependencies[name]
  }
  await run(
    ["npm", "pack", "--ignore-scripts", "--pack-destination", packDirectory],
    root,
  )
  await writeFile(
    join(consumerDirectory, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      devDependencies: peerVersions,
    }),
  )
  await run(
    [
      "npm",
      "install",
      "--save-dev",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      join(
        packDirectory,
        `tscircuit-cad-collision-checking-${manifest.version}.tgz`,
      ),
    ],
    consumerDirectory,
  )
  const lockfile = JSON.parse(
    await readFile(join(consumerDirectory, "package-lock.json"), "utf8"),
  )
  assert.equal(
    lockfile.packages["node_modules/@tscircuit/graphics-debug-3d"].version,
    "0.0.1",
  )
  assert(
    !Object.keys(lockfile.packages).some((path) =>
      path.endsWith("node_modules/manifold-3d"),
    ),
  )
  for (const name of ["runtime-smoke", "problems"]) {
    const source = await readFile(
      join(root, `tests/fixtures/${name}.ts`),
      "utf8",
    )
    await writeFile(
      join(consumerDirectory, `${name}.ts`),
      source.replaceAll('"../../lib"', '"@tscircuit/cad-collision-checking"'),
    )
  }
  await writeFile(
    join(consumerDirectory, "check.ts"),
    `
    import { checkBundledCollisionRuntime } from "./runtime-smoke"
    globalThis.fetch = () => { throw new Error("Unexpected runtime download") }
    console.log(await checkBundledCollisionRuntime())
  `,
  )
  await writeFile(
    join(consumerDirectory, "types.ts"),
    `
    import { CadCollisionCheckingSolver } from "@tscircuit/cad-collision-checking"
    import type { GraphicsObject3d } from "@tscircuit/graphics-debug-3d"
    declare const solver: CadCollisionCheckingSolver
    const graphics: GraphicsObject3d = solver.visualize3d()
  `,
  )
  await run(
    [
      "node",
      "node_modules/typescript/bin/tsc",
      "--noEmit",
      "--skipLibCheck",
      "--module",
      "esnext",
      "--moduleResolution",
      "bundler",
      "--target",
      "esnext",
      "types.ts",
    ],
    consumerDirectory,
  )
  const { metafile } = await build({
    entryPoints: [join(consumerDirectory, "check.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    metafile: true,
    outfile: join(directory, "check.mjs"),
  })
  assert(
    !Object.keys(metafile!.inputs).some((path) =>
      /node_modules\/(?:manifold-3d|three|@tscircuit\/graphics-debug-3d)\//.test(
        path,
      ),
    ),
    "Type-only debugger dependencies must not enter the solver runtime bundle",
  )
  await run(["node", "check.mjs"], directory)

  const bunConsumerDirectory = join(directory, "bun-consumer")
  await mkdir(bunConsumerDirectory)
  await writeFile(
    join(bunConsumerDirectory, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      devDependencies: {
        ...peerVersions,
        [manifest.name]: `file:${join(packDirectory, `tscircuit-cad-collision-checking-${manifest.version}.tgz`)}`,
      },
      overrides: manifest.overrides,
    }),
  )
  await run(
    [process.execPath, "install", "--ignore-scripts"],
    bunConsumerDirectory,
  )
  for (const filename of ["check.ts", "runtime-smoke.ts", "problems.ts"]) {
    await writeFile(
      join(bunConsumerDirectory, filename),
      await readFile(join(consumerDirectory, filename)),
    )
  }
  await run([process.execPath, "check.ts"], bunConsumerDirectory)
} finally {
  await rm(directory, { recursive: true, force: true })
}
