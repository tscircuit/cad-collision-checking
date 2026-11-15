import type { Manifold, ManifoldToplevel } from "@tscircuit/manifold-2d"
import { createCollisionSolid } from "./collision-mesh"
import { getInitializedCollisionManifold } from "./load-collision-manifold"
import { validateCollisionProblem } from "./validate-collision-problem"
import type { CadStaticCollision, CollisionSolid } from "./types"

/** Check positive-volume intersections between closed meshes at their supplied poses. */
export function checkStaticCollisions(
  solids: CollisionSolid[],
  options: { manifold?: ManifoldToplevel } = {},
): CadStaticCollision[] {
  validateCollisionProblem({ solids, moves: [] })
  const manifold = options.manifold ?? getInitializedCollisionManifold()
  const prepared: {
    solidId: CollisionSolid["solidId"]
    solid: Manifold
    bounds: ReturnType<Manifold["boundingBox"]>
  }[] = []
  const collisions: CadStaticCollision[] = []

  try {
    for (const { solidId, mesh } of solids) {
      const solid = createCollisionSolid(mesh, manifold)
      try {
        const bounds = solid.boundingBox()
        for (const other of prepared) {
          if (
            !bounds.min.every(
              (min, axis) =>
                min < other.bounds.max[axis] &&
                other.bounds.min[axis] < bounds.max[axis],
            )
          )
            continue

          const intersection = solid.intersect(other.solid)
          try {
            if (intersection.status() !== "NoError")
              throw new Error("Could not intersect collision solids")
            const intersectionVolumeMm3 = intersection.volume()
            const threshold = Math.max(
              1e-9,
              intersection.tolerance() * intersection.surfaceArea(),
            )
            if (intersectionVolumeMm3 > threshold) {
              collisions.push({
                solidIds: [other.solidId, solidId],
                intersectionVolumeMm3,
              })
            }
          } finally {
            intersection.delete()
          }
        }
        prepared.push({ solidId, solid, bounds })
      } catch (error) {
        solid.delete()
        throw error
      }
    }
  } finally {
    for (const { solid } of prepared) solid.delete()
  }

  return collisions
}
