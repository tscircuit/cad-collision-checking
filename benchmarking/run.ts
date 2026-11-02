import { mkdir, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { parseArgs } from "node:util"
import { CadCollisionCheckingSolver, loadCollisionManifold } from "../lib"
import {
  mountingHoles,
  nema17InsertionProblem,
  translatedMesh,
} from "../tests/fixtures/nema17-models"

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean" },
    limit: { type: "string" },
    sample: { type: "string" },
    repeat: { type: "string", default: "1" },
    snapshots: { type: "boolean" },
  },
})
if (values.help) {
  console.log(`Usage: ./benchmark.sh [--limit N] [--sample N] [--repeat N] [--snapshots]

Runs the real NEMA17 / threaded M3 collision dataset (samples numbered from 1).
Duration includes solver construction and solve; excludes model generation,
WASM loading and optional PoppyGL snapshots. Meshes are never simplified.

  --limit N    Run the first N samples
  --sample N   Run one sample: 1=four bolts, 2=5 µm offset, 3=20 µm wall,
               4=blind floor, 5=tunneling, 6=nominal, 7=withdrawal, 8=moving motor
  --repeat N   Repeat each selected sample (default 1)
  --snapshots  Save PoppyGL PNGs outside the measured interval
  --help       Show this help

Writes results/runNNN/logs.txt and metrics.json; optional PNGs are in that folder.
Reports collision correctness, constructed prisms, and avg/P50/P95 duration.`)
  process.exit(0)
}
const integer = (value: string | undefined, fallback: number) => {
  if (value === undefined) return fallback
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1)
    throw new Error("Sample, limit and repeat must be positive integers")
  return number
}
const cases = [
  { name: "four bolts", expected: 0, options: {} },
  {
    name: "5 µm offset",
    expected: 0,
    options: { holes: [mountingHoles[1]], lateralOffset: [0.003, -0.004] },
  },
  {
    name: "20 µm wall",
    expected: 1,
    options: { holes: [mountingHoles[1]], lateralOffset: [0.012, -0.016] },
  },
  {
    name: "blind floor",
    expected: 1,
    options: { holes: [mountingHoles[1]], longBolt: true },
  },
  {
    name: "tunneling",
    expected: 1,
    options: { holes: [mountingHoles[1]], endZ: -50 },
  },
  {
    name: "nominal",
    expected: 1,
    options: { holes: [mountingHoles[1]], nominal: true },
  },
  {
    name: "withdrawal",
    expected: 1,
    options: { holes: [mountingHoles[1]], nominal: true },
  },
  { name: "moving motor", expected: 0, options: {} },
] satisfies {
  name: string
  expected: number
  options: NonNullable<Parameters<typeof nema17InsertionProblem>[1]>
}[]
const sample = integer(values.sample, 0)
if (sample > cases.length) throw new Error(`Only ${cases.length} samples exist`)
const limit = integer(values.limit, cases.length)
const repeats = integer(values.repeat, 1)
const root = join(process.cwd(), "results")
await mkdir(root, { recursive: true })
const runs = (await readdir(root))
  .filter((name) => /^run\d+$/.test(name))
  .map((name) => Number(name.slice(3)))
const directory = join(
  root,
  `run${String(Math.max(0, ...runs) + 1).padStart(3, "0")}`,
)
await mkdir(directory)
const lines: string[] = []
const log = async (line: string) => {
  console.log(line)
  lines.push(line)
  await writeFile(join(directory, "logs.txt"), `${lines.join("\n")}\n`)
}
const manifold = await loadCollisionManifold()
const metrics = []
for (const [index, entry] of cases.entries()) {
  if (sample ? sample !== index + 1 : index >= limit) continue
  const problem = nema17InsertionProblem(manifold, entry.options)
  if (entry.name === "withdrawal") {
    problem.solids[1].mesh = translatedMesh(
      problem.solids[1].mesh,
      [0, 0, -7.9],
    )
    problem.moves[0].translation = [0, 0, 7.9]
  }
  if (entry.name === "moving motor") {
    problem.moves[0].solidIds = ["motor"]
    problem.moves[0].translation = [0, 0, 7.9]
  }
  for (let repetition = 1; repetition <= repeats; repetition++) {
    const start = performance.now()
    const solver = new CadCollisionCheckingSolver(problem)
    try {
      solver.solve()
      const durationMs = performance.now() - start
      const output = solver.getOutput()
      const success =
        solver.solved && output.collisions.length === entry.expected
      const id = `sample${String(index + 1).padStart(3, "0")}`
      metrics.push({
        sample: index + 1,
        name: entry.name,
        repetition,
        success,
        durationMs,
        stats: solver.stats,
        ...output,
      })
      await log(
        `${id} ${entry.name.padEnd(13)} ${success ? "success" : "FAILED "} ` +
          `repeat=${repetition} collisions=${output.collisions.length} ` +
          `prisms=${String(solver.stats.constructedPrisms).padStart(6)}/${solver.stats.sweptTriangles} ` +
          `duration=${(durationMs / 1000).toFixed(3)}s`,
      )
      await writeFile(
        join(directory, "metrics.json"),
        `${JSON.stringify(metrics, null, 2)}\n`,
      )
      if (values.snapshots && repetition === 1) {
        const { renderNema17Snapshot } = await import(
          "../tests/fixtures/render-nema17-snapshot"
        )
        const png = await renderNema17Snapshot(solver, {
          title: `NEMA17 / threaded M3: ${entry.name}`,
          cutaway:
            problem.moves[0].solidIds.length === 1 &&
            entry.name !== "moving motor",
        })
        await writeFile(join(directory, `${id}.png`), png)
      }
    } finally {
      solver.dispose()
    }
  }
}
const durations = metrics.map((row) => row.durationMs).sort((a, b) => a - b)
const percentile = (p: number) => durations[Math.ceil(p * durations.length) - 1]
const successes = metrics.filter((row) => row.success).length
await log(`success rate: ${((100 * successes) / metrics.length).toFixed(1)}%`)
await log(
  `avg duration=${(durations.reduce((a, b) => a + b, 0) / durations.length / 1000).toFixed(3)}s`,
)
await log(`P50 duration=${(percentile(0.5) / 1000).toFixed(3)}s`)
await log(`P95 duration=${(percentile(0.95) / 1000).toFixed(3)}s`)
console.log(`Wrote ${directory}`)
if (successes !== metrics.length) process.exitCode = 1
