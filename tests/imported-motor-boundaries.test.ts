import { expect, test } from "bun:test"
import {
  createCollisionSolid,
  loadCollisionManifold,
  prepareCollisionMesh,
} from "../lib"
import { loadLegacyMotor } from "./fixtures/load-legacy-motor"

test("legacy modelcdn NEMA17 boundary preparation preserves all four blind mounting bores", async () => {
  const manifold = await loadCollisionManifold()
  const original = await loadLegacyMotor()
  const before = JSON.stringify(original)
  expect(() => createCollisionSolid(original, manifold)).toThrow()
  const solid = createCollisionSolid(
    prepareCollisionMesh(original, manifold),
    manifold,
  )
  try {
    expect(solid.status()).toBe("NoError")
    expect(solid.numTri()).toBeGreaterThan(10000)
    const bounds = solid.boundingBox()
    for (let axis = 0; axis < 3; axis++) {
      const coordinates = original.vertProperties.filter(
        (_, i) => i % 3 === axis,
      )
      expect(
        Math.abs(bounds.min[axis] - Math.min(...coordinates)),
      ).toBeLessThan(0.001)
      expect(
        Math.abs(bounds.max[axis] - Math.max(...coordinates)),
      ).toBeLessThan(0.001)
    }
    for (const x of [-15.5, 15.5])
      for (const y of [-15.5, 15.5]) {
        expect(solid.rayCast([x, y, 1], [x, y, -4.4])).toEqual([])
        const floor = solid.rayCast([x, y, 1], [x, y, -6])[0]!
        expect(Math.abs(floor.position[2] + 4.5)).toBeLessThan(0.001)
        const sides = solid.rayCast([x - 2, y, -1], [x + 2, y, -1])
        expect(sides).toHaveLength(2)
        expect(
          Math.abs(sides[1]!.position[0] - sides[0]!.position[0] - 3),
        ).toBeLessThan(0.001)
      }
    // Surface-volume comparison catches cleanup that fills bores or rounds away
    // features even when the overall bounding box remains unchanged.
    let volume = 0
    for (let i = 0; i < original.triVerts.length; i += 3) {
      const [a, b, c] = original.triVerts
        .slice(i, i + 3)
        .map((v) => original.vertProperties.slice(v * 3, v * 3 + 3))
      volume +=
        (a![0]! * (b![1]! * c![2]! - b![2]! * c![1]!) +
          a![1]! * (b![2]! * c![0]! - b![0]! * c![2]!) +
          a![2]! * (b![0]! * c![1]! - b![1]! * c![0]!)) /
        6
    }
    expect(Math.abs(solid.volume() - volume) / volume).toBeLessThan(0.00002)
    expect(JSON.stringify(original)).toBe(before)
  } finally {
    solid.delete()
  }
})
