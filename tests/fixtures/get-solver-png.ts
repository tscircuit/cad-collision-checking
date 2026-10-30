import { renderGraphics3dToPng } from "@tscircuit/graphics-debug-3d"
import type { CadCollisionCheckingSolver } from "../../lib"

export const getSolverPng = (solver: CadCollisionCheckingSolver) =>
  renderGraphics3dToPng(solver.visualize3d(), {
    width: 800,
    height: 600,
    supersampling: 2,
  })
