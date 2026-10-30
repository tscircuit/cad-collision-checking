import { getSolverSvg } from "./fixtures/get-solver-svg"
import { expect, test } from "bun:test"
import { CadCollisionCheckingSolver, loadCollisionManifold } from "../lib"
import { clearanceProblem } from "./fixtures/problems"

test("sweeps preserve bores in both moving and stationary solids and allow face contact", async () => {
  const solver = new CadCollisionCheckingSolver(
    clearanceProblem(await loadCollisionManifold()),
  )
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.getOutput().collisions).toEqual([])
  await expect(getSolverSvg(solver)).toMatchSvgSnapshot(import.meta.path)
})
