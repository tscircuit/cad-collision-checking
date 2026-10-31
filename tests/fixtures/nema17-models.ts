import jscad from "@jscad/modeling"
import { modelprinter } from "@tscircuit/modelprinter"
import {
  getJscadModelForFootprint,
  geom3ToIndexedMesh,
  h,
  NEMA17,
  renderToJscadModel,
} from "jscad-electronics/vanilla"
import type { ManifoldToplevel, Vec3 } from "manifold-3d"
import {
  serializeCollisionMesh,
  type CadCollisionProblem,
  type CollisionMesh,
} from "../../lib"
import { createCollisionSolid } from "../../lib/collision-mesh"

export const motorModel = "nema17"
export const boltModel = "hexbolt_m3_l4"
export const longBoltModel = "hexbolt_m3_l6"
export const motorParameters = modelprinter.string(motorModel).json()
export const boltParameters = modelprinter.string(boltModel).json()

// The stock motor has nominal 3 mm smooth bores (no internal threads). Model
// booleans and mesh tessellation make zero-clearance contact ambiguous. Exercise
// a separately labelled, explicit 20 µm diametral-clearance variant as well.
export const clearanceBoreDiameter = 3.02
const halfPitch = 31 / 2
export const mountingHoles: Vec3[] = [
  [-halfPitch, -halfPitch, 0],
  [halfPitch, -halfPitch, 0],
  [halfPitch, halfPitch, 0],
  [-halfPitch, halfPitch, 0],
]

const meshes = new Map<string, CollisionMesh>()

/** Regenerate the published models, including threads, blind bores, shaft,
 * rear screws and wires. No boxes, hulls, hand-drawn replacement solids or
 * pre-exported fixture meshes. Cache only the owned, serializable mesh. */
export function getModelMesh(
  model: "motor" | "nominal-motor" | "bolt" | "long-bolt",
  manifold: ManifoldToplevel,
): CollisionMesh {
  const cached = meshes.get(model)
  if (cached) return structuredClone(cached)
  const geometries =
    model === "motor"
      ? renderToJscadModel(
          h(NEMA17, { mountingHoleDiameter: clearanceBoreDiameter }),
          jscad,
        ).geometries
      : getJscadModelForFootprint(
          model === "nominal-motor"
            ? motorModel
            : model === "long-bolt"
              ? longBoltModel
              : boltModel,
          jscad,
        ).geometries.map(({ geom }) => geom)
  const solids = []
  try {
    for (const geometry of geometries) {
      if (!jscad.geometries.geom3.isA(geometry))
        throw new Error("Expected a 3D modelprinter solid")
      const mesh = geom3ToIndexedMesh(geometry)
      solids.push(
        createCollisionSolid(
          {
            numProp: 3,
            vertProperties: mesh.positions,
            triVerts: mesh.indices,
          },
          manifold,
        ),
      )
    }
    const union = manifold.Manifold.union(solids)
    try {
      if (union.status() !== "NoError" || union.isEmpty())
        throw new Error(`Invalid modelprinter mesh: ${model}`)
      const mesh = serializeCollisionMesh(union)
      meshes.set(model, mesh)
      return structuredClone(mesh)
    } finally {
      union.delete()
    }
  } finally {
    for (const solid of solids) solid.delete()
  }
}

export function translatedMesh(
  mesh: CollisionMesh,
  offset: Vec3,
): CollisionMesh {
  return {
    ...mesh,
    vertProperties: mesh.vertProperties.map((n, i) =>
      i % mesh.numProp < 3 ? n + offset[i % mesh.numProp] : n,
    ),
  }
}

export function nema17InsertionProblem(
  manifold: ManifoldToplevel,
  {
    holes = mountingHoles,
    lateralOffset = [0, 0],
    nominal = false,
    longBolt = false,
    endZ = 0.1,
  }: {
    holes?: Vec3[]
    lateralOffset?: [number, number]
    nominal?: boolean
    longBolt?: boolean
    endZ?: number
  } = {},
): CadCollisionProblem {
  const startZ = 8
  return {
    solids: [
      {
        solidId: "motor",
        name: nominal ? "NEMA17: stock 3 mm bores" : "NEMA17: 3.02 mm bores",
        mesh: getModelMesh(nominal ? "nominal-motor" : "motor", manifold),
      },
      ...holes.map(([x, y], i) => ({
        solidId: `bolt${i + 1}`,
        name: longBolt ? "M3 × 6 threaded bolt" : "M3 × 4 threaded bolt",
        mesh: translatedMesh(
          getModelMesh(longBolt ? "long-bolt" : "bolt", manifold),
          [x + lateralOffset[0], y + lateralOffset[1], startZ],
        ),
      })),
    ],
    moves: [
      {
        moveId: "insert",
        name: "Insert M3 bolts into NEMA17 mounting holes",
        solidIds: holes.map((_, i) => `bolt${i + 1}`),
        translation: [0, 0, endZ - startZ],
      },
    ],
  }
}
