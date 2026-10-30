import type { GraphicsObject, Line } from "graphics-debug"
import type { Vec3 } from "manifold-3d"
import { getProblemBounds } from "./get-problem-bounds"
import type {
  CadCollisionProblem,
  CollisionMesh,
  CollisionSolidId,
} from "./types"

/** Orthographic XY/XZ/YZ views of right-handed world points in mm (+Z above).
 * Offsets are world displacement vectors. Views are laid out in drawing space;
 * orange triangles show actual swept intersection geometry, not bounding boxes. */
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
}): GraphicsObject {
  const drawing: GraphicsObject = {
    lines: [],
    points: [],
    coordinateSystem: "cartesian",
    title: `CAD collision check: ${Math.min(moveIndex, inputProblem.moves.length)}/${inputProblem.moves.length} moves complete`,
  }
  const bounds = getProblemBounds(inputProblem)
  const extent = Math.max(
    10,
    ...bounds.max.map((coordinate, axis) => coordinate - bounds.min[axis]),
  )
  for (const [viewIndex, axes] of [
    [0, 1],
    [0, 2],
    [1, 2],
  ].entries()) {
    const shiftX = (viewIndex % 2) * extent * 1.4 - bounds.min[axes[0]]
    const shiftY =
      -Math.floor(viewIndex / 2) * extent * 1.4 - bounds.min[axes[1]]
    drawing.points!.push({
      x: shiftX + bounds.min[axes[0]],
      y: shiftY + bounds.max[axes[1]] + extent * 0.12,
      label: ["XY (top)", "XZ (side)", "YZ (side)"][viewIndex],
      color: "transparent",
    })
    for (const solid of inputProblem.solids) {
      const offset = offsets.get(solid.solidId) ?? [0, 0, 0]
      drawing.lines!.push(
        ...meshLines({
          mesh: solid.mesh,
          offset,
          axes,
          shiftX,
          shiftY,
          color: "#57728b",
        }),
      )
      const positions = solid.mesh.vertProperties
      const cx = positions[axes[0]] + offset[axes[0]] + shiftX
      const cy = positions[axes[1]] + offset[axes[1]] + shiftY
      drawing.points!.push({
        x: cx,
        y: cy - extent * 0.07,
        label: solid.name,
        color: "transparent",
      })
    }
    for (const mesh of collisionMeshes)
      drawing.lines!.push(
        ...meshLines({
          mesh,
          offset: [0, 0, 0],
          axes,
          shiftX,
          shiftY,
          color: "#e05a22",
        }),
      )
  }
  drawing.points!.push(
    {
      x: extent * 1.4,
      y: -extent * 1.1,
      label: `${collisionMeshes.length} collision(s)`,
      color: "#e05a22",
    },
    {
      x: extent * 1.4,
      y: -extent * 1.25,
      label: "Orange: swept intersection",
      color: "transparent",
    },
    {
      x: extent * 1.4,
      y: -extent * 1.4,
      label: "Blue: solid triangles",
      color: "transparent",
    },
  )
  return drawing
}

function meshLines({
  mesh,
  offset,
  axes,
  shiftX,
  shiftY,
  color,
}: {
  mesh: CollisionMesh
  offset: Vec3
  axes: number[]
  shiftX: number
  shiftY: number
  color: string
}): Line[] {
  const lines: Line[] = []
  for (let index = 0; index < mesh.triVerts.length; index += 3) {
    const triangle = mesh.triVerts.slice(index, index + 3)
    lines.push({
      points: [...triangle, triangle[0]].map((vertex) => ({
        x:
          mesh.vertProperties[vertex * mesh.numProp + axes[0]] +
          offset[axes[0]] +
          shiftX,
        y:
          mesh.vertProperties[vertex * mesh.numProp + axes[1]] +
          offset[axes[1]] +
          shiftY,
      })),
      strokeColor: color,
      strokeWidth: 0.08,
    })
  }
  return lines
}
