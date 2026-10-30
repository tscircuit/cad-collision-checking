import type { Manifold, ManifoldToplevel } from "manifold-3d"
import type { CollisionMesh } from "./types"

/** Copy a borrowed solid's world-space mesh (right-handed mm, +Z above).
 * The solid remains caller-owned. No native/WASM handles escape in the result. */
export function serializeCollisionMesh(solid: Manifold): CollisionMesh {
  const mesh = solid.getMesh()
  return {
    numProp: mesh.numProp,
    vertProperties: Array.from(mesh.vertProperties),
    triVerts: Array.from(mesh.triVerts),
    mergeFromVert: Array.from(mesh.mergeFromVert),
    mergeToVert: Array.from(mesh.mergeToVert),
  }
}

/** Construct a caller-owned solid from serialized world points in mm (+Z above). */
export function createCollisionSolid(
  mesh: CollisionMesh,
  manifold: ManifoldToplevel,
): Manifold {
  let solid: Manifold
  try {
    solid = new manifold.Manifold(
      new manifold.Mesh({
        numProp: mesh.numProp,
        vertProperties: new Float32Array(mesh.vertProperties),
        triVerts: new Uint32Array(mesh.triVerts),
        mergeFromVert: mesh.mergeFromVert
          ? new Uint32Array(mesh.mergeFromVert)
          : undefined,
        mergeToVert: mesh.mergeToVert
          ? new Uint32Array(mesh.mergeToVert)
          : undefined,
      }),
    )
  } catch {
    throw new Error("Collision geometry must be a nonempty closed solid")
  }
  if (solid.status() !== "NoError" || solid.isEmpty()) {
    solid.delete()
    throw new Error("Collision geometry must be a nonempty closed solid")
  }
  return solid
}
