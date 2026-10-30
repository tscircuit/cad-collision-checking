import { expect, test } from "bun:test"
import { CadCollisionCheckingSolver, loadCollisionManifold } from "../lib"
import { thinWallProblem } from "./fixtures/problems"

test("invalid geometry and abandoned or exhausted solvers cannot claim a successful check", async () => {
  const problem = thinWallProblem(await loadCollisionManifold())
  const missing = structuredClone(problem)
  missing.moves[0].solidIds = ["MISSING"]
  expect(() => new CadCollisionCheckingSolver(missing)).toThrow("missing solid")
  const invalid = structuredClone(problem)
  invalid.solids[0].mesh.triVerts[0] = 999999
  expect(() => new CadCollisionCheckingSolver(invalid)).toThrow(
    "existing vertices",
  )
  const open = structuredClone(problem)
  open.solids[0].mesh.triVerts.splice(0, 3)
  const openSolver = new CadCollisionCheckingSolver(open)
  expect(() => openSolver.solve()).toThrow("closed solid")
  expect(openSolver.failed).toBe(true)
  expect(() => openSolver.getOutput()).toThrow()
  const abandoned = new CadCollisionCheckingSolver(problem)
  abandoned.step()
  abandoned.dispose()
  abandoned.dispose()
  abandoned.solve()
  expect(abandoned.solved).toBe(false)
  expect(abandoned.failed).toBe(true)
  const exhausted = new CadCollisionCheckingSolver(problem)
  exhausted.MAX_ITERATIONS = 1
  exhausted.solve()
  expect(exhausted.failed).toBe(true)
  expect(exhausted.solved).toBe(false)
  expect(() => exhausted.getOutput()).toThrow()
})
