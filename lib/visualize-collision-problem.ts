import type {
  GraphicsMesh3d,
  GraphicsObject3d,
  Point3d,
} from "@tscircuit/graphics-debug-3d"
import type { Vec3 } from "manifold-3d"
import { getProblemBounds } from "./get-problem-bounds"
import type {
  CadCollisionProblem,
  CollisionMesh,
  CollisionSolidId,
} from "./types"

function meshPositions(mesh: CollisionMesh): number[] {
  const positions: number[] = []
  for (let i = 0; i < mesh.vertProperties.length; i += mesh.numProp)
    positions.push(...mesh.vertProperties.slice(i, i + 3))
  return positions
}

function meshCenter(mesh: CollisionMesh): Point3d {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < mesh.vertProperties.length; i += mesh.numProp)
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], mesh.vertProperties[i + axis])
      max[axis] = Math.max(max[axis], mesh.vertProperties[i + axis])
    }
  return min.map((n, axis) => (n + max[axis]) / 2) as Point3d
}

/** Actual world-space mesh geometry, including cumulative movements and swept
 * intersections. A stable program envelope keeps snapshots comparable. */
export function visualizeCollisionProblem({
  inputProblem,
  offsets,
  collisionMeshes,
  moveIndex,
}: {
  inputProblem: CadCollisionProblem
  offsets: Map<CollisionSolidId, Vec3>
  collisionMeshes: CollisionMesh[]
  moveIndex: number
}): GraphicsObject3d {
  const movingIds = new Set(inputProblem.moves.flatMap((move) => move.solidIds))
  const meshes: GraphicsMesh3d[] = inputProblem.solids.map((solid) => ({
    id: solid.solidId,
    positions: meshPositions(solid.mesh),
    indices: [...solid.mesh.triVerts],
    position: [...(offsets.get(solid.solidId) ?? [0, 0, 0])],
    color: movingIds.has(solid.solidId) ? "#3283b5" : "#94a3b8",
    opacity: movingIds.has(solid.solidId) ? 1 : 0.45,
  }))
  for (const [index, mesh] of collisionMeshes.entries())
    meshes.push({
      id: `intersection-${index}`,
      positions: meshPositions(mesh),
      indices: [...mesh.triVerts],
      color: "#f97316",
    })
  const graphics: GraphicsObject3d = {
    title: `${Math.min(moveIndex, inputProblem.moves.length)}/${inputProblem.moves.length} moves checked - ${collisionMeshes.length} collision(s)`,
    bounds: getProblemBounds(inputProblem),
    meshes,
    lines: [],
    labels: inputProblem.solids.map((solid) => ({
      text: solid.name,
      position: meshCenter(solid.mesh).map(
        (n, axis) => n + (offsets.get(solid.solidId)?.[axis] ?? 0),
      ) as Point3d,
    })),
  }
  // Full ordered paths include movements where a part travels with a group.
  const pathOffsets = new Map<CollisionSolidId, Vec3>()
  for (const move of inputProblem.moves)
    for (const solidId of new Set(move.solidIds)) {
      const solid = inputProblem.solids.find(
        (candidate) => candidate.solidId === solidId,
      )!
      const offset = pathOffsets.get(solidId) ?? [0, 0, 0]
      const start = meshCenter(solid.mesh).map(
        (n, axis) => n + offset[axis],
      ) as Point3d
      const end = start.map((n, axis) => n + move.translation[axis]) as Point3d
      if (Math.hypot(...move.translation))
        graphics.lines!.push({
          points: [start, end],
          dashed: true,
          arrow: true,
          color: "#64748b",
        })
      pathOffsets.set(
        solidId,
        offset.map((n, axis) => n + move.translation[axis]) as Vec3,
      )
    }
  return graphics
}
