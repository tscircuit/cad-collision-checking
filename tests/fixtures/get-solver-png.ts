import { renderGraphics3dToPng } from "@tscircuit/graphics-debug-3d"
import type { GraphicsCameraFixture3d } from "@tscircuit/graphics-debug-3d"
import type { CadCollisionCheckingSolver } from "../../lib"

export const getSolverPng = (
  solver: CadCollisionCheckingSolver,
  camera?: GraphicsCameraFixture3d,
) =>
  renderGraphics3dToPng(solver.visualize3d(camera), {
    width: 800,
    height: 600,
    supersampling: 2,
  })
