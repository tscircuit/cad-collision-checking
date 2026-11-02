import {
  getManifoldModule,
  getManifoldModuleSync,
} from "@tscircuit/manifold-2d"
import { CadCollisionCheckingSolver, loadCollisionManifold } from "../../lib"
import { thinWallProblem } from "./problems"

/** Run in a fresh process/worker so other tests cannot initialize the kernel. */
export async function checkBundledCollisionRuntime() {
  if (getManifoldModuleSync() !== null)
    throw new Error("Importing collision checking eagerly initialized WASM")
  const [first, second, shared] = await Promise.all([
    loadCollisionManifold(),
    loadCollisionManifold(),
    getManifoldModule(),
  ])
  if (first !== second || first !== shared)
    throw new Error("Collision checking did not reuse the shared runtime")
  // Exercise the default constructor too: it must use the same instance.
  const solver = new CadCollisionCheckingSolver(thinWallProblem(first))
  try {
    solver.solve()
    const { collisions } = solver.getOutput()
    if (
      collisions.length !== 1 ||
      Math.abs(collisions[0]!.sweptIntersectionVolumeMm3 - 0.04) > 1e-6
    )
      throw new Error(
        "Bundled runtime missed the continuous thin-wall collision",
      )
    return { shared: true, volume: collisions[0]!.sweptIntersectionVolumeMm3 }
  } finally {
    solver.dispose()
  }
}
