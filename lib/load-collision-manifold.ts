import {
  getManifoldModule,
  getManifoldModuleSync,
  type ManifoldToplevel,
} from "@tscircuit/manifold-2d"

/** Initialize WASM only when an explosion actually needs checking. Share the
 * runtime used by copper-pour-solver, including its embedded WASM for Node,
 * browser and blob-worker bundles. No CDN or adjacent WASM asset is required.
 */
export function loadCollisionManifold(): Promise<ManifoldToplevel> {
  return getManifoldModule()
}

/** Synchronous solver construction follows async WASM initialization. */
export function getInitializedCollisionManifold(): ManifoldToplevel {
  const initialized = getManifoldModuleSync()
  if (!initialized)
    throw new Error(
      "Await loadCollisionManifold() before constructing a collision solver",
    )
  return initialized
}
