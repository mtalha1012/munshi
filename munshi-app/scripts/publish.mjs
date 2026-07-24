// Publishes the Windows installer to GitHub Releases.
import 'dotenv/config'
import { execSync } from 'node:child_process'

if (!process.env.GH_TOKEN) {
  console.error('GH_TOKEN is missing.')
  process.exit(1)
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit' })

run('electron-vite build')
run('electron-builder --win --publish always')
