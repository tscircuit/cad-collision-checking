import type { ManifoldToplevel } from "@tscircuit/manifold-2d"
import { type CadCollisionProblem, serializeCollisionMesh } from "../../lib"
import { box } from "./problems"

export function pcbBossSeparationProblem(
  manifold: ManifoldToplevel,
): CadCollisionProblem {
  const cylinder = manifold.Manifold.cylinder(6.65, 2.65, 2.65, 40, true)
  const boss = cylinder.translate([77.2, 0, -0.175])
  try {
    return {
      solids: [
        box({ solidId: "pcb", size: [150, 14, 1.6] }, manifold),
        {
          solidId: "boss",
          name: "Tray screw boss",
          mesh: serializeCollisionMesh(boss),
        },
      ],
      moves: [
        {
          moveId: "lower-tray",
          name: "Lower tray",
          solidIds: ["boss"],
          translation: [0, 0, -11],
        },
      ],
    }
  } finally {
    boss.delete()
    cylinder.delete()
  }
}
