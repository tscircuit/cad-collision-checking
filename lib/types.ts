import type { Vec3 } from "manifold-3d"

export type CollisionSolidId = string
export type CollisionMoveId = string

/** Closed triangle mesh: right-handed world points in mm, +X right, +Y top,
 * +Z above. JSON arrays preserve mesh topology and allow debugger downloads.
 * Merged vertices preserve seams in meshes with duplicated vertex properties. */
export interface CollisionMesh {
  numProp: number
  vertProperties: number[]
  triVerts: number[]
  mergeFromVert?: number[]
  mergeToVert?: number[]
}

export interface CollisionSolid {
  solidId: CollisionSolidId
  name: string
  mesh: CollisionMesh
}

/** One simultaneous translation of selected solids. Translation is a world
 * direction in mm (+X right, +Y top, +Z above), not a point. Moves run in order. */
export interface CollisionMove {
  moveId: CollisionMoveId
  name: string
  solidIds: CollisionSolidId[]
  translation: Vec3
}

export interface CadCollisionProblem {
  solids: CollisionSolid[]
  moves: CollisionMove[]
}

export interface CadCollision {
  moveId: CollisionMoveId
  movingSolidId: CollisionSolidId
  obstacleSolidId: CollisionSolidId
  /** Obstacle volume in swept space outside the moving solid's initial pose,
   * in mm³. This is not instantaneous penetration or time of first contact. */
  sweptIntersectionVolumeMm3: number
}

export interface CadCollisionResult {
  collisions: CadCollision[]
}
