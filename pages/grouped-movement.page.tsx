import { CollisionDebugger } from "./CollisionDebugger"
import { groupedProblem } from "../tests/fixtures/problems"
import { groupedCamera } from "../tests/fixtures/grouped-camera"
export default (
  <CollisionDebugger createProblem={groupedProblem} camera={groupedCamera} />
)
