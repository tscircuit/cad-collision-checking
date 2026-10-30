import { useCallback, useEffect, useRef, useState } from "react"
import { GenericSolverDebugger } from "@tscircuit/solver-utils/react"
import { InteractiveGraphics3d } from "@tscircuit/graphics-debug-3d/react"
import {
  CadCollisionCheckingSolver,
  loadCollisionManifold,
  type CadCollisionProblem,
} from "../lib"
import type { ManifoldToplevel } from "manifold-3d"

export function CollisionDebugger({
  createProblem,
}: {
  createProblem: (manifold: ManifoldToplevel) => CadCollisionProblem
}) {
  const [problem, setProblem] = useState<CadCollisionProblem>()
  const [error, setError] = useState<string>()
  const solver = useRef<CadCollisionCheckingSolver | null>(null)
  useEffect(() => {
    let cancelled = false
    loadCollisionManifold()
      .then((manifold) => {
        if (!cancelled) setProblem(createProblem(manifold))
      })
      .catch(() => {
        if (!cancelled) setError("Could not load collision geometry")
      })
    return () => {
      cancelled = true
      solver.current?.dispose()
    }
  }, [createProblem])
  const createSolver = useCallback(() => {
    solver.current?.dispose()
    solver.current = new CadCollisionCheckingSolver(problem!)
    return solver.current
  }, [problem])
  if (error) return <p>{error}</p>
  if (!problem) return <p>Loading collision geometry…</p>
  return (
    <GenericSolverDebugger
      createSolver={createSolver}
      customRenderer={{
        name: "PoppyGL 3D",
        render: () => (
          <InteractiveGraphics3d graphics={solver.current!.visualize3d()} />
        ),
        getDownload: () => solver.current!.visualize3d(),
      }}
    />
  )
}
