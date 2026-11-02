import { expect, test } from "bun:test"
import {
  CadCollisionCheckingSolver,
  loadCollisionManifold,
  prepareCollisionMesh,
} from "../lib"
import { loadLegacyMotor } from "./fixtures/load-legacy-motor"
import { getModelMesh, translatedMesh } from "./fixtures/nema17-models"

test("real M3 threads distinguish nominal contact from the legacy GLB motor blind-hole floor", async () => {
  const manifold = await loadCollisionManifold()
  const motor = prepareCollisionMesh(await loadLegacyMotor(), manifold)
  for (const long of [false, true]) {
    const solver = new CadCollisionCheckingSolver(
      {
        solids: [
          { solidId: "motor", name: "Imported NEMA17", mesh: motor },
          {
            solidId: "bolt",
            name: long ? "M3 × 6" : "M3 × 4",
            mesh: translatedMesh(
              getModelMesh(long ? "long-bolt" : "bolt", manifold),
              [15.5, 15.5, 8],
            ),
          },
        ],
        moves: [
          {
            moveId: "insert",
            name: "Insert real M3 bolt",
            solidIds: ["bolt"],
            translation: [0, 0, -7.9],
          },
        ],
      },
      { manifold },
    )
    try {
      solver.solve()
      const volume = solver
        .getOutput()
        .collisions.reduce((sum, c) => sum + c.sweptIntersectionVolumeMm3, 0)
      expect(solver.stats.checkedPairs).toBe(1)
      if (long) expect(volume).toBeGreaterThan(8)
      // Stock bores are nominal 3 mm, not tapped threads or a clearance fit.
      // Compare micrometre-scale boundary noise with the >8 mm³ blind-floor hit.
      else expect(volume).toBeLessThan(0.01)
    } finally {
      solver.dispose()
    }
  }
}, 30000)
