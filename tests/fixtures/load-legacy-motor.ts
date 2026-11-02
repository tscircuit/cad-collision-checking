import type { CollisionMesh } from "../../lib"
/** Actual modelcdn nema17_none.glb, decoded by circuit-json-to-gltf@0.0.163.
 * Model-local right-handed mm (+Z above), front mounting face z=0. */
export async function loadLegacyMotor(): Promise<CollisionMesh> {
  return JSON.parse(
    new TextDecoder().decode(
      Bun.gunzipSync(
        new Uint8Array(
          await Bun.file(
            new URL("./nema17-legacy-mesh.json.gz", import.meta.url),
          ).arrayBuffer(),
        ),
      ),
    ),
  )
}
