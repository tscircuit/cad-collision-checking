import { getSvgFromGraphicsObject } from "graphics-debug"
import type { CadCollisionCheckingSolver } from "../../lib"

export const getSolverSvg = (solver: CadCollisionCheckingSolver) =>
  getSvgFromGraphicsObject(solver.visualize(), {
    includeTextLabels: true,
    svgWidth: 1000,
    svgHeight: 700,
  })
