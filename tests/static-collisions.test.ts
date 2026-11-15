import { expect, test } from "bun:test"
import { checkStaticCollisions, loadCollisionManifold } from "../lib"
import { pcbBossSeparationProblem } from "./fixtures/pcb-boss-separation"
import { box } from "./fixtures/problems"

test("detects the screw boss penetrating the assembled PCB", async () => {
  const manifold = await loadCollisionManifold()
  const { solids } = pcbBossSeparationProblem(manifold)
  const collisions = checkStaticCollisions(solids)

  expect(collisions).toHaveLength(1)
  expect(collisions[0].solidIds).toEqual(["pcb", "boss"])
  expect(collisions[0].intersectionVolumeMm3).toBeCloseTo(1.4163, 4)
})

test("allows touching faces in the assembled pose", async () => {
  const manifold = await loadCollisionManifold()
  const solids = [
    box({ solidId: "pcb", size: [2, 2, 2] }, manifold),
    box({ solidId: "support", size: [2, 2, 2], center: [0, 0, -2] }, manifold),
  ]

  expect(checkStaticCollisions(solids)).toEqual([])
})
