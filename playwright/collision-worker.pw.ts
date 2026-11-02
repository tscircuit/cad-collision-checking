import { expect, test } from "@playwright/test"
import { build } from "esbuild"
import { resolve } from "node:path"

for (const format of ["esm", "iife"] as const) {
  test(`collision checking runs in a ${format} blob worker without runtime downloads`, async ({
    page,
  }) => {
    const { outputFiles, metafile } = await build({
      stdin: {
        contents: `
          import { checkBundledCollisionRuntime } from "./tests/fixtures/runtime-smoke"
          checkBundledCollisionRuntime().then(
            (result) => postMessage({ result }),
            (error) => postMessage({ error: String(error) }),
          )
        `,
        resolveDir: resolve(import.meta.dirname, ".."),
        loader: "ts",
      },
      bundle: true,
      platform: "browser",
      // Match the wrapper's browser test and tsup's Node builtin handling.
      // This branch is never executed in the browser worker.
      external: ["node:module"],
      format,
      write: false,
      metafile: true,
    })
    expect(
      Object.keys(metafile!.inputs).some((p) =>
        /node_modules\/manifold-3d\//.test(p),
      ),
    ).toBe(false)
    // Give the worker a normal origin, as it has in eval/RunFrame.
    await page.route("http://collision.test/", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Collision runtime test</title>",
      }),
    )
    await page.goto("http://collision.test/")
    await page.unroute("http://collision.test/")
    const requests: string[] = []
    await page.route(/^https?:/, (route) => {
      requests.push(route.request().url())
      return route.abort()
    })
    const response = await page.evaluate(
      ({ code, module }) =>
        new Promise((resolve, reject) => {
          const url = URL.createObjectURL(
            new Blob([code], { type: "text/javascript" }),
          )
          const worker = new Worker(url, {
            type: module ? "module" : "classic",
          })
          const finish = () => {
            worker.terminate()
            URL.revokeObjectURL(url)
          }
          worker.onmessage = ({ data }) => {
            finish()
            resolve(data)
          }
          worker.onerror = (error) => {
            finish()
            reject(new Error(error.message))
          }
        }),
      { code: outputFiles![0]!.text, module: format === "esm" },
    )
    expect(response).toEqual({
      result: { shared: true, volume: expect.closeTo(0.04, 6) },
    })
    expect(requests).toEqual([])
  })
}
