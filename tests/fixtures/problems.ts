import type { ManifoldToplevel, Vec3 } from "manifold-3d"
import {
  serializeCollisionMesh,
  type CadCollisionProblem,
  type CollisionSolid,
} from "../../lib"

export function box(
  {
    solidId,
    size,
    center = [0, 0, 0],
  }: { solidId: string; size: Vec3; center?: Vec3 },
  manifold: ManifoldToplevel,
): CollisionSolid {
  const cube = manifold.Manifold.cube(size, true)
  const placed = cube.translate(center)
  try {
    return { solidId, name: solidId, mesh: serializeCollisionMesh(placed) }
  } finally {
    placed.delete()
    cube.delete()
  }
}

export function thinWallProblem(
  manifold: ManifoldToplevel,
): CadCollisionProblem {
  return {
    solids: [
      box(
        { solidId: "SLIDER", size: [1, 2, 2], center: [-10, 0, 0] },
        manifold,
      ),
      box(
        { solidId: "WALL", size: [0.01, 8, 8], center: [0.017, 0, 0] },
        manifold,
      ),
    ],
    moves: [
      {
        moveId: "slide",
        name: "Slide through thin wall",
        solidIds: ["SLIDER"],
        translation: [20, 0, 0],
      },
    ],
  }
}

export function groupedProblem(
  manifold: ManifoldToplevel,
): CadCollisionProblem {
  return {
    solids: [
      box({ solidId: "COVER", size: [8, 6, 1] }, manifold),
      box({ solidId: "BOLT", size: [1, 1, 2], center: [0, 0, 3] }, manifold),
      box(
        { solidId: "BRACKET", size: [1, 3, 3], center: [6, 0, 13] },
        manifold,
      ),
    ],
    moves: [
      {
        moveId: "lift",
        name: "Lift cover and bolt together",
        solidIds: ["COVER", "BOLT", "BOLT"],
        translation: [0, 0, 10],
      },
      {
        moveId: "remove",
        name: "Remove bolt past bracket",
        solidIds: ["BOLT"],
        translation: [12, 0, 0],
      },
    ],
  }
}

export function clearanceProblem(
  manifold: ManifoldToplevel,
): CadCollisionProblem {
  const outer = manifold.Manifold.cube([10, 10, 2], true)
  const bore = manifold.Manifold.cube([4, 4, 6], true)
  const frame = outer.subtract(bore)
  try {
    return {
      solids: [
        {
          solidId: "FRAME",
          name: "FRAME (open bore)",
          mesh: serializeCollisionMesh(frame),
        },
        box({ solidId: "PIN", size: [2, 2, 2], center: [0, 0, -6] }, manifold),
        box(
          { solidId: "TOUCHING", size: [2, 2, 2], center: [2, 0, -6] },
          manifold,
        ),
      ],
      moves: [
        {
          moveId: "pin",
          name: "Pin passes through bore",
          solidIds: ["PIN"],
          translation: [0, 0, 12],
        },
        {
          moveId: "frame",
          name: "Frame passes around stationary pin",
          solidIds: ["FRAME"],
          translation: [0, 0, 12],
        },
      ],
    }
  } finally {
    frame.delete()
    bore.delete()
    outer.delete()
  }
}
