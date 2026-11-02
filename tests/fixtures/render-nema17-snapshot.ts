import { Resvg } from "@resvg/resvg-js"
import { renderGraphics3d } from "@tscircuit/graphics-debug-3d"
import { vec3 } from "gl-matrix"
import { encodePNG } from "poppygl"
import { fileURLToPath } from "node:url"
import type { CadCollisionCheckingSolver } from "../../lib"
import { getNema17Graphics } from "./nema17-graphics"

const escapeXml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

/** PoppyGL renders the actual model meshes and solver intersection meshes.
 * The SVG adds only review labels in image pixels. The callout projects an
 * actual interference vertex through that render's camera; no proxy geometry
 * or enlarged collision solid is added to the scene.
 */
export async function renderNema17Snapshot(
  solver: CadCollisionCheckingSolver,
  { title, cutaway = false }: { title: string; cutaway?: boolean },
) {
  const graphics = getNema17Graphics(solver, cutaway)
  const render = renderGraphics3d(graphics, {
    width: 800,
    height: 600,
    supersampling: 2,
  })
  const png = await encodePNG(render.bitmap)
  const intersections = graphics.meshes!.filter((mesh) =>
    mesh.id?.startsWith("intersection-"),
  )
  const collisionCount = solver.solved
    ? solver.getOutput().collisions.length
    : intersections.length
  const status = solver.failed
    ? "CHECK INCOMPLETE"
    : collisionCount
      ? `COLLISION DETECTED (${collisionCount})`
      : solver.solved
        ? "NO COLLISION DETECTED"
        : "NOT CHECKED YET — INITIAL POSE"
  const statusColor = collisionCount
    ? "#b91c1c"
    : solver.solved
      ? "#166534"
      : "#92400e"
  const headerHeight = 104
  let callout = ""
  if (intersections.length) {
    // Pick the real interference vertex nearest the authored camera so the
    // marker points to its visible side, rather than the bolt's opaque center.
    const camera = graphics.cameraPosition!
    let nearest: [number, number, number] = [0, 0, 0]
    let distance = Infinity
    for (const mesh of intersections)
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const point = mesh.positions.slice(i, i + 3) as [number, number, number]
        const candidate = vec3.squaredDistance(point, camera)
        if (candidate < distance) {
          nearest = point
          distance = candidate
        }
      }
    const screen = vec3.transformMat4(
      vec3.create(),
      nearest,
      render.camera.view,
    )
    vec3.transformMat4(screen, screen, render.camera.proj)
    const x = ((screen[0] + 1) / 2) * 800
    const y = ((1 - screen[1]) / 2) * 600 + headerHeight
    const labelX = Math.max(24, Math.min(630, x > 400 ? x - 220 : x + 70))
    const labelY = Math.max(headerHeight + 35, Math.min(660, y + 55))
    callout = `
      <circle cx="${x}" cy="${y}" r="13" fill="none" stroke="#b91c1c" stroke-width="3"/>
      <path d="M ${labelX + 72} ${labelY - 14} L ${x} ${y}" stroke="#b91c1c" stroke-width="2" fill="none"/>
      <rect x="${labelX}" y="${labelY - 29}" width="144" height="29" rx="4" fill="#b91c1c"/>
      <text x="${labelX + 12}" y="${labelY - 9}" fill="white" font-size="15">INTERFERENCE</text>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="786" viewBox="0 0 800 786">
    <rect width="800" height="786" fill="#f7f9fc"/>
    <g font-family="Roboto Mono">
      <rect width="800" height="48" fill="${statusColor}"/>
      <text x="22" y="32" fill="white" font-size="23">${escapeXml(status)}</text>
      <text x="22" y="77" fill="#0f172a" font-size="18">${escapeXml(title)}</text>
      <image x="0" y="${headerHeight}" width="800" height="600" href="data:image/png;base64,${Buffer.from(png).toString("base64")}"/>
      ${callout}
      <rect x="0" y="704" width="800" height="82" fill="white"/>
      <rect x="22" y="720" width="15" height="15" fill="#f97316"/>
      <text x="48" y="733" fill="#0f172a" font-size="16">Orange = actual new swept interference</text>
      <text x="22" y="764" fill="#475569" font-size="14">${!solver.solved ? "Real NEMA17 and threaded M3 meshes; checking has not completed." : cutaway ? "Motor sectioned for viewing; the full motor is collision-checked." : "Real NEMA17 and threaded M3 meshes; the complete path is checked."}</text>
    </g>
  </svg>`
  return new Resvg(svg, {
    font: {
      loadSystemFonts: false,
      fontFiles: [
        fileURLToPath(new URL("./assets/RobotoMono.ttf", import.meta.url)),
      ],
      defaultFontFamily: "Roboto Mono",
    },
  })
    .render()
    .asPng()
}
