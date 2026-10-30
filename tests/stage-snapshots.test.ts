import { expect, test } from "bun:test"
import { CadCollisionCheckingSolver, loadCollisionManifold } from "../lib"
import { groupedProblem } from "./fixtures/problems"
import { getSolverPng } from "./fixtures/get-solver-png"

test("PoppyGL snapshots show the assembled pose, grouped lift and separate bolt removal", async () => {
  const solver = new CadCollisionCheckingSolver(
    groupedProblem(await loadCollisionManifold()),
  )
  const assembled = solver.visualize3d()
  expect(await getSolverPng(solver)).toMatchPngSnapshot(
    import.meta.path,
    "stage-0-assembled",
  )
  while (solver.stats.completedMoves < 1) solver.step()
  const lifted = solver.visualize3d()
  expect(lifted.meshes!.find((mesh) => mesh.id === "COVER")!.position).toEqual([
    0, 0, 10,
  ])
  expect(lifted.meshes!.find((mesh) => mesh.id === "BOLT")!.position).toEqual([
    0, 0, 10,
  ])
  expect(lifted.bounds).toEqual(assembled.bounds)
  expect(await getSolverPng(solver)).toMatchPngSnapshot(
    import.meta.path,
    "stage-1-lift-cover-and-bolt",
  )
  solver.solve()
  const removed = solver.visualize3d()
  expect(removed.meshes!.find((mesh) => mesh.id === "BOLT")!.position).toEqual([
    12, 0, 10,
  ])
  expect(removed.meshes!.some((mesh) => mesh.id === "intersection-0")).toBe(
    true,
  )
  expect(removed.bounds).toEqual(assembled.bounds)
  expect(await getSolverPng(solver)).toMatchPngSnapshot(
    import.meta.path,
    "stage-2-remove-bolt",
  )
})
