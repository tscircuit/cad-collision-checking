import { expect, test } from "bun:test"
import { Resvg } from "@resvg/resvg-js"
import { renderGraphics3dToPng } from "@tscircuit/graphics-debug-3d"
import { fileURLToPath } from "node:url"
import {
  CadCollisionCheckingSolver,
  createCollisionSolid,
  loadCollisionManifold,
  serializeCollisionMesh,
} from "../lib"
import { pcbBossSeparationProblem } from "./fixtures/pcb-boss-separation"

test("lowering the tray sweeps no new PCB volume despite the initial boss overlap", async () => {
  const manifold = await loadCollisionManifold()
  const problem = pcbBossSeparationProblem(manifold)
  const solver = new CadCollisionCheckingSolver(problem)
  const [board, boss] = problem.solids.map(({ mesh }) =>
    createCollisionSolid(mesh, manifold),
  )
  const initialOverlap = board.intersect(boss)
  const loweredBoss = boss.translate(problem.moves[0].translation)
  try {
    const volume = initialOverlap.volume()
    expect(volume).toBeCloseTo(1.416, 3)
    const { min, max } = initialOverlap.boundingBox()
    expect(max[0] - min[0]).toBeCloseTo(0.45, 3)
    expect(loweredBoss.boundingBox().max[2]).toBeLessThan(
      board.boundingBox().min[2],
    )

    const graphics = solver.visualize3d({
      cameraPosition: [89, -14, 11],
      cameraTarget: [75, 0, 0],
    })
    graphics.labels = []
    graphics.lines = []
    const [boardMesh, bossMesh] = graphics.meshes!
    boardMesh.opacity = 0.48
    bossMesh.opacity = 0.24
    const { vertProperties, triVerts } = serializeCollisionMesh(initialOverlap)
    graphics.meshes!.push({
      id: "initial-overlap",
      positions: vertProperties,
      indices: triVerts,
      color: "#e66b26",
    })

    solver.solve()
    expect(solver.stats.checkedPairs).toBe(1)
    expect(solver.getOutput().collisions).toEqual([])

    const png = await renderGraphics3dToPng(graphics, {
      width: 760,
      height: 380,
      supersampling: 2,
    })
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="526">
      <rect width="760" height="526" fill="#f7f9fc"/>
      <image x="0" y="86" width="760" height="380" href="data:image/png;base64,${Buffer.from(png).toString("base64")}"/>
      <rect x="0" y="418" width="760" height="108" fill="white"/>
      <path d="M 0 418 H 760" stroke="#e2e8f0"/>
      <g font-family="Roboto Mono" fill="#0f172a">
        <text x="24" y="37" font-size="23">Tray screw boss overlaps the PCB</text>
        <text x="24" y="67" font-size="15">Assembled pose · board edge at x = 75 mm</text>
        <rect x="24" y="437" width="14" height="14" fill="#e66b26"/>
        <text x="47" y="449" font-size="15">Initial overlap · ${volume.toFixed(3)} mm³ · 0.45 mm into PCB</text>
        <text x="24" y="476" font-size="15">Movement · tray lowers 11 mm in −Z</text>
        <text x="24" y="503" font-size="15">New swept intersection · 0 mm³</text>
      </g>
    </svg>`
    expect(
      new Resvg(svg, {
        font: {
          loadSystemFonts: false,
          fontFiles: [
            fileURLToPath(
              new URL("./fixtures/assets/RobotoMono.ttf", import.meta.url),
            ),
          ],
          defaultFontFamily: "Roboto Mono",
        },
      })
        .render()
        .asPng(),
    ).toMatchPngSnapshot(import.meta.path)
  } finally {
    loweredBoss.delete()
    initialOverlap.delete()
    boss.delete()
    board.delete()
    solver.dispose()
  }
})
