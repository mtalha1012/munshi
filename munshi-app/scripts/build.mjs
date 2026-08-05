// Builds the Windows installer. Pass --publish to upload it to GitHub Releases.
//
// Why this wrapper exists: makensis.exe memory-maps a temp file the size of the
// whole compressed payload (~90 MB). Windows puts TEMP on C:, and when C: runs
// low on space that mapping fails with the opaque
//   Internal compiler error #12345: error creating mmap the size of N
// so we point the child process at a temp dir on the project's own drive, which
// has room. Keep both build scripts going through here so neither can regress.
import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publish = process.argv.includes('--publish')

if (publish && !process.env.GH_TOKEN) {
  console.error('GH_TOKEN is missing.')
  process.exit(1)
}

const tmpDir = resolve(projectDir, '.build-tmp')
rmSync(tmpDir, { recursive: true, force: true })
mkdirSync(tmpDir, { recursive: true })

const env = { ...process.env, TMP: tmpDir, TEMP: tmpDir, TMPDIR: tmpDir }
// Run the tools' JS entrypoints under node rather than their .bin/*.cmd shims:
// Node 24 refuses to spawn a .cmd without a shell, and shell:true would leave
// the arguments unescaped (this project's path contains spaces).
const entry = (pkg, rel) => resolve(projectDir, 'node_modules', pkg, rel)
const run = (script, args) =>
  execFileSync(process.execPath, [script, ...args], { stdio: 'inherit', env, cwd: projectDir })

try {
  run(entry('electron-vite', 'bin/electron-vite.js'), ['build'])
  run(entry('electron-builder', 'cli.js'), ['--win', '--publish', publish ? 'always' : 'never'])
} finally {
  rmSync(tmpDir, { recursive: true, force: true })
}
