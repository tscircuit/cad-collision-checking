import { geometries, measurements, geom3ToIndexedMesh } from "@tscircuit/jscad"
import type { ManifoldToplevel } from "@tscircuit/manifold-2d"
import { createCollisionSolid, serializeCollisionMesh } from "./collision-mesh"
import type { CollisionMesh } from "./types"

/** Prepare imported triangle surfaces for collision checking. Points are in
 * right-handed world millimetres (+Z above); triangle winding is outward CCW.
 * Valid solids take the unchanged path. For nonconforming triangle boundaries,
 * reuse the JSCAD kernel's boundary subdivision, with its adjustment tolerance
 * capped at 0.001 mm. This does not cap holes, create hulls, or replace surfaces.
 * Open/invalid meshes and models requiring a coarser adjustment still throw.
 * The returned mesh owns no WASM resources; the input is never modified.
 */
export function prepareCollisionMesh(
  mesh: CollisionMesh,
  manifold: ManifoldToplevel,
): CollisionMesh {
  const vertexCount = mesh.vertProperties.length / mesh.numProp
  if (
    !Number.isInteger(mesh.numProp) ||
    mesh.numProp < 3 ||
    !Number.isInteger(vertexCount) ||
    vertexCount === 0 ||
    mesh.triVerts.length === 0 ||
    mesh.triVerts.length % 3 !== 0 ||
    mesh.vertProperties.some((value) => !Number.isFinite(value)) ||
    mesh.triVerts.some(
      (index) => !Number.isInteger(index) || index < 0 || index >= vertexCount,
    )
  )
    throw new Error("Collision geometry requires finite indexed triangles")

  const validated = (candidate: CollisionMesh) => {
    const solid = createCollisionSolid(candidate, manifold)
    try {
      return serializeCollisionMesh(solid)
    } finally {
      solid.delete()
    }
  }
  try {
    return validated(mesh)
  } catch {
    // Legacy JSCAD OBJ/GLB exports can have an edge spanning a neighboring
    // triangle's middle vertex. Rendering hides that missing subdivision.
  }
  const polygons: [number, number, number][][] = []
  for (let i = 0; i < mesh.triVerts.length; i += 3) {
    polygons.push(
      mesh.triVerts.slice(i, i + 3).map((index) => {
        const offset = index * mesh.numProp
        return [
          mesh.vertProperties[offset]!,
          mesh.vertProperties[offset + 1]!,
          mesh.vertProperties[offset + 2]!,
        ]
      }),
    )
  }
  const geometry = geometries.geom3.fromPoints(polygons)
  // geom3ToIndexedMesh uses twice measureEpsilon for boundary subdivisions;
  // snapping itself moves each coordinate by at most epsilon / 2.
  if (2 * measurements.measureEpsilon(geometry) > 0.001)
    throw new Error("Collision mesh boundary adjustment would exceed 0.001 mm")
  const prepared = geom3ToIndexedMesh(geometry)
  return validated({
    numProp: 3,
    vertProperties: prepared.positions,
    triVerts: prepared.indices,
  })
}
