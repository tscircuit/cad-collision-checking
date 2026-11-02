# Legacy NEMA17 mesh reproduction

`nema17-legacy-mesh.json.gz` is the unmodified indexed surface returned by
`circuit-json-to-gltf@0.0.163`'s `loadCadComponentMesh`, using
`nema17-legacy-cad.json`. The source is the actual jscad-electronics motor at
<https://modelcdn.tscircuit.com/jscad_models/nema17_none.glb>, pinned from the
RP2040 assembly in core's `tests/assembly/fixtures/rp2040-explosion`.

Source GLB SHA-256:
`c999cb092cf9b7105280101b9e6c5fe5e4f06d782a27b9bf5728f530b8ceb8be`.
The model is in right-handed millimetres, +Z along the shaft, mounting face z=0.
This stores the actual imported triangles, including their missing boundary
subdivisions; it is not a replacement motor or a pre-repaired collision fixture.
Tests run the production mesh preparation on those original triangles.

To reproduce the capture in an environment with `circuit-json-to-gltf@0.0.163`:

```ts
import { loadCadComponentMesh } from "circuit-json-to-gltf"
import { cad_component } from "circuit-json"
const cad = cad_component.parse(await Bun.file("nema17-legacy-cad.json").json())
const mesh = await loadCadComponentMesh(cad)
await Bun.write("nema17-legacy-mesh.json.gz", Bun.gzipSync(JSON.stringify({
  numProp: 3,
  vertProperties: mesh.positions,
  triVerts: mesh.indices,
})))
```

Verify source bytes against the hash before refreshing. `bun test tests/imported-m`
checks that the raw surface fails solid validation, preparation retains all four
3 mm × 4.5 mm blind bores, the bounds stay within 0.001 mm, volume changes by less
than 0.002%, and real threaded M3 bolts distinguish nominal contact from the blind
floor. Open surfaces, invalid indices and inward winding remain rejected.
