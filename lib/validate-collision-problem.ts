import { validateCollisionMesh } from "./collision-mesh"
import type { CadCollisionProblem } from "./types"

export function validateCollisionProblem(problem: CadCollisionProblem) {
  const solidIds = new Set(problem.solids.map((solid) => solid.solidId))
  if (solidIds.size !== problem.solids.length)
    throw new Error("Collision solid identities must be unique")
  if (
    new Set(problem.moves.map((move) => move.moveId)).size !==
    problem.moves.length
  )
    throw new Error("Collision move identities must be unique")
  for (const solid of problem.solids) validateCollisionMesh(solid.mesh)
  for (const move of problem.moves) {
    if (
      move.translation.length !== 3 ||
      !move.translation.every(Number.isFinite)
    )
      throw new Error(
        "Collision translations require three finite millimetre coordinates",
      )
    if (move.solidIds.some((solidId) => !solidIds.has(solidId)))
      throw new Error("Collision movement targets a missing solid")
  }
}
