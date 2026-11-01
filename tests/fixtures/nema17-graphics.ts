import type {
  CadCollisionCheckingSolver,
  CadCollisionProblem,
  CollisionMesh,
} from "../../lib"
import { getInitializedCollisionManifold } from "../../lib/load-collision-manifold"
import {
  createCollisionSolid,
  serializeCollisionMesh,
} from "../../lib/collision-mesh"
import { nema17Camera, nema17HoleCamera } from "./nema17-camera"

const sections = new WeakMap<CadCollisionProblem, CollisionMesh>()

/** Display-only section of the actual input motor mesh. The solver always
 * checks the entire uncut motor; neither this cutaway nor camera affects it. */
export function getNema17Graphics(
  solver: CadCollisionCheckingSolver,
  cutaway = false,
) {
  const graphics = solver.visualize3d(cutaway ? nema17HoleCamera : nema17Camera)
  // The page/README captions identify the models without obscuring the holes.
  graphics.labels = []
  if (!cutaway) return graphics
  let section = sections.get(solver.inputProblem)
  if (!section) {
    const manifold = getInitializedCollisionManifold()
    const motor = createCollisionSolid(
      solver.inputProblem.solids[0].mesh,
      manifold,
    )
    const box = manifold.Manifold.cube([10, 8, 12], true)
    const placedBox = box.translate([15.5, -11.5, -4])
    const clipped = motor.intersect(placedBox)
    try {
      if (clipped.status() !== "NoError" || clipped.isEmpty())
        throw new Error("Could not section the motor for visualization")
      section = serializeCollisionMesh(clipped)
      sections.set(solver.inputProblem, section)
    } finally {
      clipped.delete()
      placedBox.delete()
      box.delete()
      motor.delete()
    }
  }
  const motor = graphics.meshes!.find((mesh) => mesh.id === "motor")!
  motor.positions = section.vertProperties
  motor.indices = section.triVerts
  motor.opacity = 1
  graphics.bounds = { min: [10.5, -19, -10], max: [20.5, -7.5, 10] }
  return graphics
}
