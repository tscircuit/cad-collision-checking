import { beforeAll, expect, test } from "bun:test"
import type { ManifoldToplevel, Vec3 } from "manifold-3d"
import { CadCollisionCheckingSolver, loadCollisionManifold } from "../lib"
import { createCollisionSolid } from "../lib/collision-mesh"
import {
  boltParameters,
  getModelMesh,
  motorParameters,
  mountingHoles,
  nema17InsertionProblem,
  translatedMesh,
} from "./fixtures/nema17-models"
import { renderGraphics3dToPng } from "@tscircuit/graphics-debug-3d"
import { getNema17Graphics } from "./fixtures/nema17-graphics"

let manifold: ManifoldToplevel
beforeAll(async () => {
  manifold = await loadCollisionManifold()
})
const oneHole = [mountingHoles[1]]

test("published modelprinter models retain real threads, blind holes and closed mesh topology", () => {
  expect(motorParameters).toMatchObject({
    nemaSize: 17,
    mountingHoleSpacing: 31,
    mountingHoleDiameter: 3,
    mountingHoleDepth: 4.5,
    mountingHoleThrough: false,
  })
  expect(boltParameters).toMatchObject({
    metricSize: "M3",
    length: 4,
    diameter: 3,
    showThreads: true,
  })
  for (const model of [
    "motor",
    "nominal-motor",
    "bolt",
    "long-bolt",
  ] as const) {
    const mesh = getModelMesh(model, manifold)
    // Prevent accidentally replacing the models with primitive proxies.
    expect(mesh.triVerts.length / 3).toBeGreaterThan(
      model.includes("motor") ? 10000 : 40000,
    )
    const solid = createCollisionSolid(mesh, manifold)
    try {
      expect(solid.status()).toBe("NoError")
      expect(solid.volume()).toBeGreaterThan(0)
    } finally {
      solid.delete()
    }
  }
})

test("all four threaded M3 bolts fit through overlapping bounds into the real motor's clearance bores", async () => {
  const problem = nema17InsertionProblem(manifold)
  const solver = new CadCollisionCheckingSolver(problem)
  try {
    expect(
      await renderGraphics3dToPng(getNema17Graphics(solver), {
        width: 800,
        height: 600,
        supersampling: 2,
      }),
    ).toMatchPngSnapshot(import.meta.path, "nema17-m3-before-insertion")
    solver.solve()
    expect(solver.solved).toBe(true)
    // Every bolt reaches the mesh narrow phase despite overlapping motor AABBs.
    expect(solver.stats.checkedPairs).toBe(4)
    expect(solver.getOutput().collisions).toEqual([])
    expect(
      await renderGraphics3dToPng(getNema17Graphics(solver), {
        width: 800,
        height: 600,
        supersampling: 2,
      }),
    ).toMatchPngSnapshot(import.meta.path, "nema17-m3-inserted")
  } finally {
    solver.dispose()
  }
}, 120000)

test("5 µm lateral offset still fits the 10 µm radial clearance", () => {
  const solver = new CadCollisionCheckingSolver(
    nema17InsertionProblem(manifold, {
      holes: oneHole,
      lateralOffset: [0.003, -0.004],
    }),
  )
  try {
    solver.solve()
    expect(solver.stats.checkedPairs).toBe(1)
    expect(solver.getOutput().collisions).toEqual([])
  } finally {
    solver.dispose()
  }
}, 30000)

test("the moving motor preserves its bores around four stationary bolts, even in a rotated world frame", () => {
  const problem = nema17InsertionProblem(manifold)
  // Change the whole scene frame, not the relative fit or the supplied meshes.
  const rotate = (point: Vec3): Vec3 => {
    let [x, y, z] = point
    const [a, b, c] = [27, -19, 41].map((n) => (n * Math.PI) / 180)
    ;[y, z] = [
      y * Math.cos(a) - z * Math.sin(a),
      y * Math.sin(a) + z * Math.cos(a),
    ]
    ;[x, z] = [
      x * Math.cos(b) + z * Math.sin(b),
      -x * Math.sin(b) + z * Math.cos(b),
    ]
    return [
      x * Math.cos(c) - y * Math.sin(c),
      x * Math.sin(c) + y * Math.cos(c),
      z,
    ]
  }
  for (const solid of problem.solids) {
    const { mesh } = solid
    for (let i = 0; i < mesh.vertProperties.length; i += mesh.numProp) {
      const p = rotate(mesh.vertProperties.slice(i, i + 3) as Vec3)
      for (let axis = 0; axis < 3; axis++)
        mesh.vertProperties[i + axis] = p[axis] + [43, -27, 19][axis]
    }
  }
  problem.moves = [
    {
      moveId: "motor-up",
      name: "Move motor around the stationary bolts",
      solidIds: ["motor"],
      translation: rotate([0, 0, 7.9]),
    },
  ]
  const solver = new CadCollisionCheckingSolver(problem)
  try {
    solver.solve()
    expect(solver.stats.checkedPairs).toBe(4)
    expect(solver.getOutput().collisions).toEqual([])
  } finally {
    solver.dispose()
  }
}, 60000)

test("a bolt passes through clear endpoint poses but hits the motor between them", () => {
  const problem = nema17InsertionProblem(manifold, {
    holes: oneHole,
    endZ: -50,
  })
  const motor = createCollisionSolid(problem.solids[0].mesh, manifold)
  try {
    for (const offset of [[0, 0, 0], problem.moves[0].translation] as Vec3[]) {
      const bolt = createCollisionSolid(
        translatedMesh(problem.solids[1].mesh, offset),
        manifold,
      )
      const overlap = motor.intersect(bolt)
      try {
        expect(overlap.volume()).toBe(0)
      } finally {
        overlap.delete()
        bolt.delete()
      }
    }
  } finally {
    motor.delete()
  }
  const solver = new CadCollisionCheckingSolver(problem)
  try {
    solver.solve()
    expect(solver.getOutput().collisions).toHaveLength(1)
    expect(
      solver.getOutput().collisions[0].sweptIntersectionVolumeMm3,
    ).toBeGreaterThan(10)
  } finally {
    solver.dispose()
  }
}, 60000)

test("withdrawal from a nominal bore ignores only the initial mesh overlap", () => {
  const problem = nema17InsertionProblem(manifold, {
    holes: oneHole,
    nominal: true,
  })
  problem.solids[1].mesh = translatedMesh(problem.solids[1].mesh, [0, 0, -7.9])
  problem.moves[0].translation = [0, 0, 7.9]
  const solver = new CadCollisionCheckingSolver(problem)
  try {
    solver.solve()
    expect(solver.stats.checkedPairs).toBe(1)
    // The helically threaded surface sweeps new material while translating
    // without rotation, even when withdrawing. Do not exempt an entire pair
    // merely because its starting pose already overlapped.
    expect(solver.getOutput().collisions).toHaveLength(1)
    expect(
      solver.getOutput().collisions[0].sweptIntersectionVolumeMm3,
    ).toBeLessThan(0.005)
  } finally {
    solver.dispose()
  }
}, 30000)

test("20 µm misalignment catches the bore wall, not just gross bounding-box overlaps", async () => {
  const solver = new CadCollisionCheckingSolver(
    nema17InsertionProblem(manifold, {
      holes: oneHole,
      lateralOffset: [0.012, -0.016],
    }),
  )
  try {
    solver.solve()
    expect(solver.getOutput().collisions).toMatchObject([
      {
        moveId: "insert",
        movingSolidId: "bolt1",
        obstacleSolidId: "motor",
      },
    ])
    expect(
      solver.getOutput().collisions[0].sweptIntersectionVolumeMm3,
    ).toBeGreaterThan(0.01)
    expect(
      await renderGraphics3dToPng(getNema17Graphics(solver, true), {
        width: 800,
        height: 600,
        supersampling: 2,
      }),
    ).toMatchPngSnapshot(import.meta.path, "nema17-m3-misaligned")
  } finally {
    solver.dispose()
  }
}, 30000)

test("a long M3 bolt strikes the blind hole floor while its head remains above the mounting face", async () => {
  const solver = new CadCollisionCheckingSolver(
    nema17InsertionProblem(manifold, {
      holes: oneHole,
      longBolt: true,
    }),
  )
  try {
    solver.solve()
    expect(solver.getOutput().collisions).toMatchObject([
      {
        moveId: "insert",
        movingSolidId: "bolt1",
        obstacleSolidId: "motor",
      },
    ])
    expect(
      solver.getOutput().collisions[0].sweptIntersectionVolumeMm3,
    ).toBeGreaterThan(1)
    // Intersection is below the 4.5 mm blind-hole floor, not the cap's face.
    const intersection = solver
      .visualize3d()
      .meshes!.find((m) => m.id === "intersection-0")!
    const z = intersection.positions.filter((_, i) => i % 3 === 2)
    expect(Math.max(...z)).toBeLessThan(-4.49)
    expect(Math.min(...z)).toBeLessThan(-5.8)
    expect(
      await renderGraphics3dToPng(getNema17Graphics(solver, true), {
        width: 800,
        height: 600,
        supersampling: 2,
      }),
    ).toMatchPngSnapshot(import.meta.path, "nema17-m3-blind-hole-floor")
  } finally {
    solver.dispose()
  }
}, 60000)

test("stock zero-clearance models expose their sub-micron surface overlap rather than silently ignoring it", () => {
  const solver = new CadCollisionCheckingSolver(
    nema17InsertionProblem(manifold, {
      holes: oneHole,
      nominal: true,
    }),
  )
  try {
    solver.solve()
    expect(solver.getOutput().collisions).toHaveLength(1)
    const volume = solver.getOutput().collisions[0].sweptIntersectionVolumeMm3
    expect(volume).toBeGreaterThan(0)
    expect(volume).toBeLessThan(0.005)
  } finally {
    solver.dispose()
  }
}, 30000)
