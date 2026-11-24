import { expect, test } from "bun:test"
import {
  createCollisionSolid,
  loadCollisionManifold,
  serializeCollisionMesh,
} from "../lib"

test("createCollisionSolid rejects malformed indices before typed-array coercion", async () => {
  const manifold = await loadCollisionManifold()
  const cube = manifold.Manifold.cube([1, 1, 1], true)
  const valid = serializeCollisionMesh(cube)
  cube.delete()

  const fractionalTriangle = structuredClone(valid)
  fractionalTriangle.triVerts[0] += 0.5
  expect(() => createCollisionSolid(fractionalTriangle, manifold)).toThrow(
    "triangle indices",
  )

  const fractionalMerge = structuredClone(valid)
  fractionalMerge.mergeFromVert = [0.5]
  fractionalMerge.mergeToVert = [1]
  expect(() => createCollisionSolid(fractionalMerge, manifold)).toThrow(
    "merge indices",
  )

  const fractionalStride = structuredClone(valid)
  fractionalStride.numProp = 3.5
  expect(() => createCollisionSolid(fractionalStride, manifold)).toThrow(
    "finite triangle geometry",
  )
})
