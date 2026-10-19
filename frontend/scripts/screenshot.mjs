// Usage: node scripts/screenshot.mjs <url> <out.png> <width> <height> [full]
// Screenshots a page at an exact viewport via the Chrome DevTools Protocol
// (headless Edge clamps --window-size to >= ~500px wide).
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, out, w, h, full] = process.argv.slice(2)
const EDGE = process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9333
const profile = mkdtempSync(join(tmpdir(), 'edge-cdp-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'])

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
setTimeout(() => { console.error("timed out"); edge.kill(); process.exit(1) }, 120_000).unref()  // first visit to a page can include Vite compiling it
let target
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === 'page') }
  catch { await sleep(200) }
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(r => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })

const width = Number(w), height = Number(h)
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
await send('Page.enable')
await send('Page.navigate', { url })
await sleep(9000)
const metrics = await send('Runtime.evaluate', {
  expression: 'JSON.stringify({inner: innerWidth, scroll: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight})',
  returnByValue: true,
})
const m = JSON.parse(metrics.result.result.value)
console.log(`viewport=${m.inner} scrollWidth=${m.scroll} pageHeight=${m.height}`)
const shot = await send('Page.captureScreenshot', full
  ? { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: m.height, scale: 1 } }
  : { format: 'png' })
writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
ws.close()
edge.kill()
process.exit(0)
