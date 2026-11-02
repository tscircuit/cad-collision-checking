import { expect, test } from "bun:test"
import { loadCollisionManifold, prepareCollisionMesh } from "../lib"
import { loadLegacyMotor } from "./fixtures/load-legacy-motor"
import { getModelMesh } from "./fixtures/nema17-models"

test("mesh preparation rejects open models, invalid indices and oversized repair tolerances", async () => {
  const manifold = await loadCollisionManifold()
  const bolt = getModelMesh("bolt", manifold)
  const open = { ...bolt, triVerts: bolt.triVerts.slice(3) }
  expect(() => prepareCollisionMesh(open, manifold)).toThrow()
  expect(() =>
    prepareCollisionMesh({ ...bolt, triVerts: [-1, 0, 1] }, manifold),
  ).toThrow("finite indexed triangles")
  const nonfinite = {
    ...bolt,
    vertProperties: [NaN, ...bolt.vertProperties.slice(1)],
  }
  expect(() => prepareCollisionMesh(nonfinite, manifold)).toThrow(
    "finite indexed triangles",
  )
  const reversed = {
    ...bolt,
    triVerts: bolt.triVerts.flatMap((_, i) =>
      i % 3 === 0
        ? [bolt.triVerts[i], bolt.triVerts[i + 2], bolt.triVerts[i + 1]]
        : [],
    ),
  }
  expect(() => prepareCollisionMesh(reversed, manifold)).toThrow()
  const large = await loadLegacyMotor()
  large.vertProperties = large.vertProperties.map((v) => v * 10)
  expect(() => prepareCollisionMesh(large, manifold)).toThrow("exceed 0.001 mm")
})
