import { BaseSolver } from "@tscircuit/solver-utils"
import type {
  GraphicsObject3d,
  GraphicsCameraFixture3d,
} from "@tscircuit/graphics-debug-3d"
import type { Manifold, ManifoldToplevel, Vec3 } from "manifold-3d"
import { createCollisionSolid, serializeCollisionMesh } from "./collision-mesh"
import { createTranslationSweep } from "./create-translation-sweep"
import { getInitializedCollisionManifold } from "./load-collision-manifold"
import { validateCollisionProblem } from "./validate-collision-problem"
import { visualizeCollisionProblem } from "./visualize-collision-problem"
import type {
  CadCollision,
  CadCollisionProblem,
  CadCollisionResult,
  CollisionMesh,
  CollisionSolidId,
} from "./types"

const boundsOverlap = (
  a: ReturnType<Manifold["boundingBox"]>,
  b: ReturnType<Manifold["boundingBox"]>,
) =>
  [0, 1, 2].every(
    (axis) => a.min[axis] < b.max[axis] && b.min[axis] < a.max[axis],
  )

/** Continuous translation checks in right-handed world mm (+X right, +Y top,
 * +Z above). One step prepares a solid, starts a sweep, checks one obstacle, or
 * translates one target. Native geometry is released on completion/failure;
 * call dispose() when abandoning an unfinished interactive solver.
 * The algorithm knows nothing about Circuit JSON, React, CAD loading or core. */
export class CadCollisionCheckingSolver extends BaseSolver {
  readonly inputProblem: CadCollisionProblem
  private readonly manifold: ManifoldToplevel
  private readonly solids = new Map<CollisionSolidId, Manifold>()
  private readonly offsets = new Map<CollisionSolidId, Vec3>()
  private readonly collisions: CadCollision[] = []
  private readonly collisionMeshes: CollisionMesh[] = []
  private preparedCount = 0
  private moveIndex = 0
  private movingIndex = 0
  private translatedCount = 0
  private checkedPairCount = 0
  private candidates: CollisionSolidId[] = []
  private candidateIndex = 0
  private entered?: Manifold
  private disposed = false

  constructor(
    inputProblem: CadCollisionProblem,
    options: { manifold?: ManifoldToplevel } = {},
  ) {
    super()
    validateCollisionProblem(inputProblem)
    this.inputProblem = structuredClone(inputProblem)
    this.manifold = options.manifold ?? getInitializedCollisionManifold()
    this.MAX_ITERATIONS =
      inputProblem.solids.length +
      inputProblem.moves.reduce(
        (total, move) =>
          total +
          new Set(move.solidIds).size * (inputProblem.solids.length + 3) +
          1,
        1,
      )
    this.refreshStats()
  }

  override _step() {
    try {
      this.advance()
      this.refreshStats()
    } catch (error) {
      this.dispose()
      throw error
    }
  }

  private advance() {
    if (this.preparedCount < this.inputProblem.solids.length) {
      const solid = this.inputProblem.solids[this.preparedCount]
      this.solids.set(
        solid.solidId,
        createCollisionSolid(solid.mesh, this.manifold),
      )
      this.offsets.set(solid.solidId, [0, 0, 0])
      this.preparedCount++
      return
    }
    const move = this.inputProblem.moves[this.moveIndex]
    if (!move) {
      this.solved = true
      this.dispose()
      return
    }
    const movingSolidIds = [...new Set(move.solidIds)]
    if (!Math.hypot(...move.translation)) {
      this.moveIndex++
      return
    }
    if (this.movingIndex < movingSolidIds.length) {
      const movingSolidId = movingSolidIds[this.movingIndex]
      const movingSolid = this.solids.get(movingSolidId)!
      if (!this.entered) {
        const bounds = movingSolid.boundingBox()
        const sweptBounds = {
          min: bounds.min.map(
            (coordinate, axis) =>
              coordinate + Math.min(0, move.translation[axis]),
          ) as Vec3,
          max: bounds.max.map(
            (coordinate, axis) =>
              coordinate + Math.max(0, move.translation[axis]),
          ) as Vec3,
        }
        this.candidates = [...this.solids]
          .filter(
            ([solidId, solid]) =>
              !movingSolidIds.includes(solidId) &&
              boundsOverlap(sweptBounds, solid.boundingBox()),
          )
          .map(([solidId]) => solidId)
        if (!this.candidates.length) {
          this.movingIndex++
          return
        }
        const sweep = createTranslationSweep(
          { solid: movingSolid, displacement: move.translation },
          this.manifold,
        )
        try {
          // Exclude existing occupied space, not the whole overlapping pair:
          // separating is allowed, but moving deeper still enters new geometry.
          this.entered = sweep.subtract(movingSolid)
          if (this.entered.status() !== "NoError")
            throw new Error("Could not evaluate newly swept geometry")
        } finally {
          sweep.delete()
        }
        this.candidateIndex = 0
        return
      }
      const obstacleSolidId = this.candidates[this.candidateIndex]
      if (obstacleSolidId === undefined) {
        this.entered.delete()
        this.entered = undefined
        this.movingIndex++
        return
      }
      const intersection = this.entered.intersect(
        this.solids.get(obstacleSolidId)!,
      )
      try {
        if (intersection.status() !== "NoError")
          throw new Error("Could not intersect collision solids")
        const sweptIntersectionVolumeMm3 = intersection.volume()
        const threshold = Math.max(
          1e-9,
          intersection.tolerance() * intersection.surfaceArea(),
        )
        if (sweptIntersectionVolumeMm3 > threshold) {
          this.collisions.push({
            moveId: move.moveId,
            movingSolidId,
            obstacleSolidId,
            sweptIntersectionVolumeMm3,
          })
          this.collisionMeshes.push(serializeCollisionMesh(intersection))
        }
      } finally {
        intersection.delete()
      }
      this.checkedPairCount++
      this.candidateIndex++
      return
    }
    // All targets are tested against the same pre-move scene. Moving targets
    // never become obstacles to each other, and duplicate selections move once.
    if (this.translatedCount < movingSolidIds.length) {
      const solidId = movingSolidIds[this.translatedCount]
      const solid = this.solids.get(solidId)!
      const translated = solid.translate(move.translation)
      if (translated.status() !== "NoError") {
        translated.delete()
        throw new Error("Could not translate collision solid")
      }
      this.solids.set(solidId, translated)
      solid.delete()
      const offset = this.offsets.get(solidId)!
      this.offsets.set(
        solidId,
        offset.map(
          (coordinate, axis) => coordinate + move.translation[axis],
        ) as Vec3,
      )
      this.translatedCount++
      return
    }
    this.moveIndex++
    this.movingIndex = 0
    this.translatedCount = 0
  }

  private refreshStats() {
    this.stats = {
      phase: this.solved
        ? "complete"
        : this.preparedCount < this.inputProblem.solids.length
          ? "prepare_solids"
          : "check_movements",
      move: this.inputProblem.moves[this.moveIndex]?.name ?? "none",
      preparedSolids: this.preparedCount,
      completedMoves: this.moveIndex,
      checkedPairs: this.checkedPairCount,
      collisions: this.collisions.length,
    }
  }

  computeProgress() {
    if (this.solved) return 1
    const preparation =
      this.preparedCount / Math.max(1, this.inputProblem.solids.length)
    const moves = this.moveIndex / Math.max(1, this.inputProblem.moves.length)
    return 0.1 * preparation + 0.9 * moves
  }

  override getConstructorParams(): [CadCollisionProblem] {
    return [structuredClone(this.inputProblem)]
  }

  override getOutput(): CadCollisionResult {
    if (!this.solved) throw new Error("Collision checking has not completed")
    return { collisions: structuredClone(this.collisions) }
  }

  visualize3d(camera: GraphicsCameraFixture3d = {}): GraphicsObject3d {
    return {
      ...visualizeCollisionProblem({
        inputProblem: this.inputProblem,
        offsets: this.offsets,
        collisionMeshes: this.collisionMeshes,
        moveIndex: this.moveIndex,
      }),
      ...camera,
    }
  }

  override tryFinalAcceptance() {
    this.dispose()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.entered?.delete()
    this.entered = undefined
    for (const solid of this.solids.values()) solid.delete()
    this.solids.clear()
    if (!this.solved && !this.failed) {
      this.failed = true
      this.error = "Collision check disposed before completion"
    }
  }
}
