import { getSolverSvg } from "./fixtures/get-solver-svg"
import { expect, test } from "bun:test"
import { CadCollisionCheckingSolver, loadCollisionManifold } from "../lib"
import { thinWallProblem } from "./fixtures/problems"

test("continuous sweeps catch a thin obstacle between clear endpoints", async () => {
  const manifold = await loadCollisionManifold()
  const solver = new CadCollisionCheckingSolver(thinWallProblem(manifold))
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput().collisions).toHaveLength(1)
  expect(solver.getOutput().collisions[0]).toMatchObject({
    moveId: "slide",
    movingSolidId: "SLIDER",
    obstacleSolidId: "WALL",
  })
  expect(
    solver.getOutput().collisions[0].sweptIntersectionVolumeMm3,
  ).toBeCloseTo(0.04, 5)
  await expect(getSolverSvg(solver)).toMatchSvgSnapshot(import.meta.path)
})
