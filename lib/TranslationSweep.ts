import type { Manifold, ManifoldToplevel, Vec3 } from "@tscircuit/manifold-2d"

type Bounds = ReturnType<Manifold["boundingBox"]>
type Triangle = {
  indices: number[]
  vertices: Vec3[]
  sweptBounds: Bounds
}

const boundsOverlap = (a: Bounds, b: Bounds) =>
  [0, 1, 2].every(
    (axis) => a.min[axis] < b.max[axis] && b.min[axis] < a.max[axis],
  )

/** Continuous translation of a borrowed solid, in world mm (+Z above).
 * Cache the leading triangles once per moving part. Native CSG is restricted
 * to each obstacle's possible collision region; this object owns no handles.
 */
export class TranslationSweep {
  private readonly triangles: Triangle[] = []
  private readonly sweptBounds: Bounds

  constructor(
    private readonly solid: Manifold,
    private readonly displacement: Vec3,
    private readonly manifold: ManifoldToplevel,
  ) {
    const mesh = solid.getMesh()
    const points: Vec3[] = []
    const min: Vec3 = [Infinity, Infinity, Infinity]
    const max: Vec3 = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < mesh.vertProperties.length; i += mesh.numProp) {
      const point: Vec3 = [
        mesh.vertProperties[i],
        mesh.vertProperties[i + 1],
        mesh.vertProperties[i + 2],
      ]
      points.push(point)
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], point[axis])
        max[axis] = Math.max(max[axis], point[axis])
      }
    }
    this.sweptBounds = this.getSweptBounds(min, max)
    for (let i = 0; i < mesh.triVerts.length; i += 3) {
      const indices = Array.from(mesh.triVerts.subarray(i, i + 3))
      const vertices = indices.map((index) => points[index])
      const [a, b, c] = vertices
      const ab = b.map((v, axis) => v - a[axis])
      const ac = c.map((v, axis) => v - a[axis])
      const facing =
        (ab[1] * ac[2] - ab[2] * ac[1]) * displacement[0] +
        (ab[2] * ac[0] - ab[0] * ac[2]) * displacement[1] +
        (ab[0] * ac[1] - ab[1] * ac[0]) * displacement[2]
      if (facing <= 0) continue
      this.triangles.push({
        indices,
        vertices,
        sweptBounds: this.getSweptBounds(
          [0, 1, 2].map((axis) => Math.min(a[axis], b[axis], c[axis])) as Vec3,
          [0, 1, 2].map((axis) => Math.max(a[axis], b[axis], c[axis])) as Vec3,
        ),
      })
    }
  }

  private getSweptBounds(min: Vec3, max: Vec3): Bounds {
    return {
      min: min.map(
        (v, axis) => v + Math.min(0, this.displacement[axis]),
      ) as Vec3,
      max: max.map(
        (v, axis) => v + Math.max(0, this.displacement[axis]),
      ) as Vec3,
    }
  }

  private translated(point: Vec3): Vec3 {
    return point.map((v, axis) => v + this.displacement[axis]) as Vec3
  }

  /** Return the caller-owned intersection with NEW occupied space, plus work
   * counters. Bounds and the convex envelope only reject work; a reported hit
   * always comes from the original triangle prisms and the obstacle mesh.
   *
   * If P is the union of all leading triangle prisms, S the starting solid and
   * O the obstacle, the answer is (P \ S) ∩ O. A hull H containing every prism
   * that can reach O gives R = (H ∩ O) \ S, so P ∩ R is the same answer. Prisms
   * disjoint from R can be omitted without changing that set. This also covers
   * containment, disconnected solids, concavities, and existing overlaps.
   */
  intersect(obstacle: Manifold): {
    intersection: Manifold
    sweptTriangles: number
    constructedPrisms: number
  } {
    const { manifold, sweptBounds } = this
    const handles: Manifold[] = []
    const own = (solid: Manifold) => {
      handles.push(solid)
      return solid
    }
    const check = (solid: Manifold) => {
      if (solid.status() !== "NoError")
        throw new Error("Could not evaluate continuous collision geometry")
      return solid
    }
    let intersection: Manifold | undefined
    let constructedPrisms = 0
    const result = (solid: Manifold) => {
      intersection = check(solid)
      return {
        intersection,
        sweptTriangles: this.triangles.length,
        constructedPrisms,
      }
    }
    const empty = () => result(own(manifold.Manifold.union([])))
    try {
      // Crop the obstacle before collecting prisms: remote features such as a
      // motor shaft must not enlarge the local bounds around a mounting hole.
      const cube = own(
        manifold.Manifold.cube(
          sweptBounds.max.map((v, axis) => v - sweptBounds.min[axis]) as Vec3,
        ),
      )
      const clip = own(cube.translate(sweptBounds.min))
      const local = check(own(obstacle.intersect(clip)))
      if (local.isEmpty()) return result(local)
      const localBounds = local.boundingBox()
      const candidates = this.triangles.filter((triangle) =>
        boundsOverlap(triangle.sweptBounds, localBounds),
      )
      if (!candidates.length) return empty()

      const vertices = new Map<number, Vec3>()
      for (const triangle of candidates)
        triangle.indices.forEach((index, i) =>
          vertices.set(index, triangle.vertices[i]),
        )
      const points = [...vertices.values()]
      const envelope = own(
        manifold.Manifold.hull([
          ...points,
          ...points.map((point) => this.translated(point)),
        ]),
      )
      const possible = check(own(envelope.intersect(local)))
      if (possible.isEmpty()) return result(possible)
      // Subtract initially occupied SPACE, never exempt a whole overlapping
      // pair: separating is allowed, entering additional material still hits.
      const region = check(own(possible.subtract(this.solid)))
      if (region.isEmpty()) return result(region)
      // Separate patches can have a very large combined AABB (e.g. tiny thread
      // interferences around a bore). Keep each connected region's own bounds.
      const regions = region.decompose()
      handles.push(...regions)
      const regionBounds = regions.map((part) => part.boundingBox())
      const prisms: Manifold[] = []
      for (const triangle of candidates) {
        if (
          !regionBounds.some((bounds) =>
            boundsOverlap(triangle.sweptBounds, bounds),
          )
        )
          continue
        prisms.push(
          own(
            manifold.Manifold.hull([
              ...triangle.vertices,
              ...triangle.vertices.map((point) => this.translated(point)),
            ]),
          ),
        )
      }
      constructedPrisms = prisms.length
      const sweep = own(manifold.Manifold.union(prisms))
      return result(own(sweep.intersect(region)))
    } finally {
      // Force evaluation above before releasing operands. The sole escaping
      // handle is the checked result, including every early empty result.
      for (const handle of handles) if (handle !== intersection) handle.delete()
    }
  }
}
