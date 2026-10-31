import { getSolverPng } from "./fixtures/get-solver-png"
import { expect, test } from "bun:test"
import { CadCollisionCheckingSolver, loadCollisionManifold } from "../lib"
import { groupedProblem } from "./fixtures/problems"

test("grouped targets move once and later checks use their displaced positions", async () => {
  const solver = new CadCollisionCheckingSolver(
    groupedProblem(await loadCollisionManifold()),
  )
  solver.solve()
  expect(solver.getOutput().collisions).toHaveLength(1)
  expect(solver.getOutput().collisions[0]).toMatchObject({
    moveId: "remove",
    movingSolidId: "BOLT",
    obstacleSolidId: "BRACKET",
  })
  expect(solver.stats.completedMoves).toBe(2)
  await expect(await getSolverPng(solver)).toMatchPngSnapshot(import.meta.path)
})
