import { expect, test } from "bun:test"
import { CadCollisionCheckingSolver, loadCollisionManifold } from "../lib"
import { groupedProblem } from "./fixtures/problems"
import { groupedCamera } from "./fixtures/grouped-camera"

test("stage progression retains group offsets, collision meshes and the authored camera", async () => {
  const solver = new CadCollisionCheckingSolver(
    groupedProblem(await loadCollisionManifold()),
  )
  const assembled = solver.visualize3d(groupedCamera)
  expect(assembled.cameraPosition).toEqual(groupedCamera.cameraPosition)
  expect(assembled.cameraTarget).toEqual(groupedCamera.cameraTarget)
  while (solver.stats.completedMoves < 1) solver.step()
  const lifted = solver.visualize3d(groupedCamera)
  expect(lifted.meshes!.find((mesh) => mesh.id === "COVER")!.position).toEqual([
    0, 0, 10,
  ])
  expect(lifted.meshes!.find((mesh) => mesh.id === "BOLT")!.position).toEqual([
    0, 0, 10,
  ])
  expect(lifted.bounds).toEqual(assembled.bounds)
  expect(lifted.cameraPosition).toEqual(assembled.cameraPosition)
  solver.solve()
  const removed = solver.visualize3d(groupedCamera)
  expect(removed.meshes!.find((mesh) => mesh.id === "BOLT")!.position).toEqual([
    12, 0, 10,
  ])
  expect(removed.meshes!.some((mesh) => mesh.id === "intersection-0")).toBe(
    true,
  )
  expect(removed.bounds).toEqual(assembled.bounds)
  expect(removed.cameraPosition).toEqual(assembled.cameraPosition)
})
