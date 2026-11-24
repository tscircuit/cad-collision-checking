import type { Manifold, ManifoldToplevel } from "@tscircuit/manifold-2d"
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

export function validateCollisionMesh(mesh: CollisionMesh) {
  if (
    !Number.isInteger(mesh.numProp) ||
    mesh.numProp < 3 ||
    !mesh.vertProperties.length ||
    mesh.vertProperties.length % mesh.numProp ||
    !mesh.triVerts.length ||
    mesh.triVerts.length % 3 ||
    !mesh.vertProperties.every(Number.isFinite)
  )
    throw new Error("Collision meshes require finite triangle geometry")
  const vertexCount = mesh.vertProperties.length / mesh.numProp
  if (
    !mesh.triVerts.every(
      (vertex) =>
        Number.isInteger(vertex) && vertex >= 0 && vertex < vertexCount,
    )
  )
    throw new Error(
      "Collision mesh triangle indices must reference existing vertices",
    )
  if (
    (mesh.mergeFromVert?.length ?? 0) !== (mesh.mergeToVert?.length ?? 0) ||
    ![...(mesh.mergeFromVert ?? []), ...(mesh.mergeToVert ?? [])].every(
      (vertex) =>
        Number.isInteger(vertex) && vertex >= 0 && vertex < vertexCount,
    )
  )
    throw new Error(
      "Collision mesh merge indices must reference existing vertices",
    )
}

/** Construct a caller-owned solid from serialized world points in mm (+Z above). */
export function createCollisionSolid(
  mesh: CollisionMesh,
  manifold: ManifoldToplevel,
): Manifold {
  validateCollisionMesh(mesh)
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
  if (solid.status() !== "NoError" || solid.isEmpty() || solid.volume() <= 0) {
    solid.delete()
    throw new Error("Collision geometry must be a nonempty closed solid")
  }
  return solid
}
