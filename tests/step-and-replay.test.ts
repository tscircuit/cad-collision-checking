import { getSolverSvg } from "./fixtures/get-solver-svg"
import { expect, test } from "bun:test"
import { CadCollisionCheckingSolver, loadCollisionManifold } from "../lib"
import { groupedProblem } from "./fixtures/problems"

test("stepping exposes progress and serializable constructor input replays without mutating the caller", async () => {
  const problem = groupedProblem(await loadCollisionManifold())
  const original = JSON.stringify(problem)
  const solver = new CadCollisionCheckingSolver(problem)
  solver.step()
  expect(solver.solved).toBe(false)
  expect(solver.stats.preparedSolids).toBe(1)
  expect(solver.progress).toBeGreaterThan(0)
  expect(() => solver.getOutput()).toThrow("has not completed")
  const [replayProblem] = JSON.parse(
    JSON.stringify(solver.getConstructorParams()),
  )
  const replay = new CadCollisionCheckingSolver(replayProblem)
  solver.solve()
  replay.solve()
  expect(solver.getOutput()).toEqual(replay.getOutput())
  expect(solver.progress).toBe(1)
  expect(solver.iterations).toBeGreaterThan(10)
  expect(JSON.stringify(problem)).toBe(original)
  await expect(getSolverSvg(solver)).toMatchSvgSnapshot(import.meta.path)
})
