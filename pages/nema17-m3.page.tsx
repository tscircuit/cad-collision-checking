import { useCallback, useState } from "react"
import type { ManifoldToplevel } from "manifold-3d"
import { CollisionDebugger } from "./CollisionDebugger"
import {
  mountingHoles,
  nema17InsertionProblem,
} from "../tests/fixtures/nema17-models"
import { getNema17Graphics } from "../tests/fixtures/nema17-graphics"

export default function Nema17M3Debugger() {
  const [scenario, setScenario] = useState("fit")
  const createProblem = useCallback(
    (manifold: ManifoldToplevel) =>
      nema17InsertionProblem(
        manifold,
        scenario === "fit"
          ? {}
          : {
              holes: [mountingHoles[1]],
              longBolt: scenario === "floor",
              nominal: scenario === "nominal",
              lateralOffset: scenario === "wall" ? [0.012, -0.016] : [0, 0],
            },
      ),
    [scenario],
  )
  return (
    <>
      <div style={{ padding: "12px 16px", maxWidth: 1100 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600 }}>
          NEMA17 / threaded M3 mesh collision checks
        </h2>
        <label>
          Scenario:{" "}
          <select
            value={scenario}
            onChange={(event) => setScenario(event.target.value)}
            style={{ border: "1px solid #94a3b8", padding: "4px 8px" }}
          >
            <option value="fit">Four M3 x 4 bolts fit in 3.02 mm bores</option>
            <option value="wall">
              20 µm misalignment: bore wall collision (cutaway)
            </option>
            <option value="floor">
              M3 x 6: blind hole floor collision (cutaway)
            </option>
            <option value="nominal">
              Stock 3 mm bores: sub-micron model overlap (cutaway)
            </option>
          </select>
        </label>
        <p>
          Actual jscad-electronics models, including full helical bolt threads.
          The fit variant explicitly uses 3.02 mm smooth bores (10 µm radial
          clearance); internal motor threads are not modeled.
        </p>
        <p>
          {scenario === "fit"
            ? "All four mounting holes are checked."
            : "The cutaway is for viewing only; collision checks use the entire motor."}{" "}
          Orange shows swept interference. Each continuous mesh sweep can take
          several seconds.
        </p>
      </div>
      <CollisionDebugger
        key={scenario}
        createProblem={createProblem}
        visualize={(solver) => getNema17Graphics(solver, scenario !== "fit")}
      />
    </>
  )
}
