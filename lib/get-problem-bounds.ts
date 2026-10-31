import type { Vec3 } from "manifold-3d"
import type { CadCollisionProblem, CollisionSolidId } from "./types"

/** Stable world-space point bounds (right-handed mm, +Z above) including every
 * movement endpoint. Only used to frame debugger drawings, never for clearance. */
export function getProblemBounds(problem: CadCollisionProblem) {
  if (!problem.solids.length) {
    return { min: [0, 0, 0] as Vec3, max: [0, 0, 0] as Vec3 }
  }
  const bounds = {
    min: [Infinity, Infinity, Infinity] as Vec3,
    max: [-Infinity, -Infinity, -Infinity] as Vec3,
  }
  const offsets = new Map<CollisionSolidId, Vec3>()
  for (const solid of problem.solids) offsets.set(solid.solidId, [0, 0, 0])
  for (let moveIndex = -1; moveIndex < problem.moves.length; moveIndex++) {
    if (moveIndex >= 0) {
      const move = problem.moves[moveIndex]
      for (const solidId of new Set(move.solidIds)) {
        const offset = offsets.get(solidId)!
        offsets.set(
          solidId,
          offset.map(
            (coordinate, axis) => coordinate + move.translation[axis],
          ) as Vec3,
        )
      }
    }
    for (const solid of problem.solids) {
      const offset = offsets.get(solid.solidId)!
      for (
        let vertex = 0;
        vertex < solid.mesh.vertProperties.length;
        vertex += solid.mesh.numProp
      )
        for (let axis = 0; axis < 3; axis++) {
          const coordinate =
            solid.mesh.vertProperties[vertex + axis] + offset[axis]
          bounds.min[axis] = Math.min(bounds.min[axis], coordinate)
          bounds.max[axis] = Math.max(bounds.max[axis], coordinate)
        }
    }
  }
  return bounds
}
