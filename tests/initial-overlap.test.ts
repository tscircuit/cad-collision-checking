import { expect, test } from "bun:test"
import { CadCollisionCheckingSolver, loadCollisionManifold } from "../lib"
import { box } from "./fixtures/problems"

test("existing overlaps may separate while deeper movement reports new occupied volume", async () => {
  const manifold = await loadCollisionManifold()
  const solids = [
    box({ solidId: "MOVING", size: [4, 4, 4] }, manifold),
    box({ solidId: "OBSTACLE", size: [4, 4, 4], center: [3, 0, 0] }, manifold),
  ]
  for (const distance of [-8, 8]) {
    const solver = new CadCollisionCheckingSolver({
      solids,
      moves: [
        {
          moveId: "move",
          name:
            distance < 0
              ? "Separate existing overlap"
              : "Enter more obstacle volume",
          solidIds: ["MOVING"],
          translation: [distance, 0, 0],
        },
      ],
    })
    solver.solve()
    if (distance < 0) expect(solver.getOutput().collisions).toHaveLength(0)
    else {
      expect(
        solver.getOutput().collisions[0].sweptIntersectionVolumeMm3,
      ).toBeCloseTo(48, 5)
      await expect(solver.visualize()).toMatchGraphicsSvg(import.meta.path)
    }
  }
})
