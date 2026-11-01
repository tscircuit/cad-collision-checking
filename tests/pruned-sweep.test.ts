import { beforeAll, expect, test } from "bun:test"
import type { Manifold, ManifoldToplevel, Vec3 } from "manifold-3d"
import { loadCollisionManifold } from "../lib"
import { TranslationSweep } from "../lib/TranslationSweep"
import { createTranslationSweep } from "./fixtures/create-unpruned-translation-sweep"

let manifold: ManifoldToplevel
beforeAll(async () => {
  manifold = await loadCollisionManifold()
})

function compareWithUnpruned(
  moving: Manifold,
  obstacle: Manifold,
  displacement: Vec3,
) {
  const sweep = createTranslationSweep(
    { solid: moving, displacement },
    manifold,
  )
  const entered = sweep.subtract(moving)
  const expected = entered.intersect(obstacle)
  const { intersection } = new TranslationSweep(
    moving,
    displacement,
    manifold,
  ).intersect(obstacle)
  try {
    expect(intersection.status()).toBe("NoError")
    expect(expected.status()).toBe("NoError")
    expect(intersection.volume()).toBeCloseTo(expected.volume(), 5)
    // Compare the distribution of occupied volume as well as its total. Clipping
    // both results independently avoids subtracting coincident, differently
    // triangulated surfaces from each other in the reference comparison.
    const bounds = obstacle.boundingBox()
    const cuts = [0, 1, 2].map((axis) => [
      bounds.min[axis] - 1,
      bounds.min[axis] + 0.371 * (bounds.max[axis] - bounds.min[axis]),
      bounds.min[axis] + 0.683 * (bounds.max[axis] - bounds.min[axis]),
      bounds.max[axis] + 1,
    ])
    for (let x = 0; x < 3; x++)
      for (let y = 0; y < 3; y++)
        for (let z = 0; z < 3; z++) {
          const indices = [x, y, z]
          const min = indices.map((index, axis) => cuts[axis][index]) as Vec3
          const size = indices.map(
            (index, axis) => cuts[axis][index + 1] - min[axis],
          ) as Vec3
          const cube = manifold.Manifold.cube(size)
          const cell = cube.translate(min)
          const a = expected.intersect(cell)
          const b = intersection.intersect(cell)
          try {
            expect(a.status()).toBe("NoError")
            expect(b.status()).toBe("NoError")
            expect(b.volume()).toBeCloseTo(a.volume(), 5)
          } finally {
            for (const solid of [cube, cell, a, b]) solid.delete()
          }
        }
  } finally {
    for (const solid of [sweep, entered, expected, intersection]) solid.delete()
  }
}

test("pruning agrees with unpruned sweeps for rotated, hollow and disconnected meshes", () => {
  const owned: Manifold[] = []
  const own = (solid: Manifold) => {
    owned.push(solid)
    return solid
  }
  const cube = own(manifold.Manifold.cube([6, 6, 2], true))
  const bore = own(manifold.Manifold.cylinder(8, 1.5, 1.5, 24, true))
  const frame = own(cube.subtract(bore))
  const pin = own(manifold.Manifold.cylinder(1.5, 1, 1, 16, true))
  const satellite = own(pin.translate([5, -2, 1]))
  const disconnected = own(manifold.Manifold.union([frame, satellite]))
  let seed = 1093
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  try {
    for (let i = 0; i < 24; i++) {
      const moving = own(
        [frame, disconnected, pin][i % 3].rotate([
          random() * 90,
          random() * 90,
          random() * 90,
        ]),
      )
      const rotated = own([pin, cube, frame][i % 3].rotate([23, -17, 41]))
      const obstacle = own(
        rotated.translate([
          random() * 8 - 4,
          random() * 8 - 4,
          random() * 8 - 4,
        ]),
      )
      compareWithUnpruned(moving, obstacle, [
        random() * 12 - 6,
        random() * 12 - 6,
        random() * 12 - 6,
      ])
    }
  } finally {
    for (const solid of owned) solid.delete()
  }
})

test("a tiny obstacle fully contained between clear endpoints is still detected", () => {
  const cube = manifold.Manifold.cube([2, 2, 2], true)
  const start = cube.translate([-10, 0, 0])
  const obstacle = manifold.Manifold.cube([0.05, 0.05, 0.05], true)
  try {
    compareWithUnpruned(start, obstacle, [20, 0, 0])
    const { intersection } = new TranslationSweep(
      start,
      [20, 0, 0],
      manifold,
    ).intersect(obstacle)
    try {
      expect(intersection.volume()).toBeCloseTo(0.000125, 9)
    } finally {
      intersection.delete()
    }
  } finally {
    for (const solid of [cube, start, obstacle]) solid.delete()
  }
})

test("fully contained initial overlap is excluded without excluding new occupied space", () => {
  const big = manifold.Manifold.cube([10, 10, 10], true)
  const small = manifold.Manifold.cube([1, 1, 1], true)
  try {
    compareWithUnpruned(big, small, [20, 0, 0])
    compareWithUnpruned(small, big, [0.2, 0, 0])
    for (const [moving, obstacle, expected] of [
      [big, small, 0],
      [small, big, 0.2],
    ] as const) {
      const { intersection } = new TranslationSweep(
        moving,
        [0.2, 0, 0],
        manifold,
      ).intersect(obstacle)
      try {
        expect(intersection.volume()).toBeCloseTo(expected, 6)
      } finally {
        intersection.delete()
      }
    }
  } finally {
    big.delete()
    small.delete()
  }
})
