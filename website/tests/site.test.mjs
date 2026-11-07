import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

let server
let baseUrl

before(async () => {
  const listener = createServer()
  await new Promise((resolve, reject) => {
    listener.once('error', reject)
    listener.listen(0, '127.0.0.1', resolve)
  })
  const { port } = listener.address()
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()))
  baseUrl = `http://127.0.0.1:${port}`

  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  await new Promise((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 15000)
    const onOutput = (data) => {
      output += data.toString()
      if (output.includes('Ready')) {
        clearTimeout(timeout)
        resolve()
      }
    }
    server.stdout.on('data', onOutput)
    server.stderr.on('data', onOutput)
    server.once('error', (error) => { clearTimeout(timeout); reject(error) })
    server.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Server exited (${code}): ${output}`)) })
  })
})

after(() => server?.kill())

for (const [locale, title, availability, faq, description] of [
  ['en', 'Bough is free', 'Public download links are not available here yet.', 'Where can I download Bough?', 'Bough is a free, native Git client'],
  ['de', 'Bough ist kostenlos', 'Öffentliche Download-Links stehen hier derzeit noch nicht zur Verfügung.', 'Wo kann ich Bough herunterladen?', 'Bough ist ein kostenloser, nativer Git-Client'],
]) {
  test(`${locale}: landing page, download information, FAQ and SEO`, async () => {
    const response = await fetch(`${baseUrl}/${locale}`)
    assert.equal(response.status, 200)
    const html = await response.text()
    assert.match(html, new RegExp(`<html lang="${locale}"`))
    assert.ok(html.includes(title))
    assert.ok(html.includes(availability))
    assert.ok(html.includes(faq))
    assert.ok(html.includes(`<meta name="description" content="${description}`))
    assert.ok(html.includes(`<meta property="og:description" content="${description}`))
    assert.ok(html.includes(`<meta name="twitter:description" content="${description}`))
    assert.ok(html.includes(`https://boughapp.com/${locale}`))
    assert.match(html, /id="download"/)
    assert.match(html, /href="(?:\/(?:en|de))?#download"/)
    assert.doesNotMatch(html, /(?:stripe|\/api\/checkout|€29|testversion|free trial)/i)
  })
}

test('removed purchase routes are not served', async () => {
  for (const path of ['/en/success', '/de/success']) {
    assert.equal((await fetch(`${baseUrl}${path}`)).status, 404)
  }
  assert.equal((await fetch(`${baseUrl}/api/checkout`, { method: 'POST' })).status, 404)
})
