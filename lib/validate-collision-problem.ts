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
  for (const solid of problem.solids) {
    const mesh = solid.mesh
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
