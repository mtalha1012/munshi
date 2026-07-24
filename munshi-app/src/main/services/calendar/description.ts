export interface ManagedInfo {
  stage?: string
  judge?: string
}
export interface ManagedOpts {
  trackStage: boolean
  trackJudges: boolean
}

function isManagedLine(line: string): boolean {
  return /^Stage:/.test(line) || line.trim() === 'Judges:' || /^•/.test(line)
}

function normJudge(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

// Keeps a stage line and newest-first judge list at the top of the description,
// leaving the user's own text below the blank line untouched.
export function applyManagedDescription(
  description: string | undefined,
  info: ManagedInfo,
  opts: ManagedOpts
): string {
  const lines = (description ?? '').split('\n')

  let i = 0
  const managed: string[] = []
  while (i < lines.length && isManagedLine(lines[i])) {
    managed.push(lines[i])
    i++
  }
  const rest =
    managed.length > 0 && i < lines.length && lines[i].trim() === ''
      ? lines.slice(i + 1)
      : lines.slice(i)

  let existingStage: string | undefined
  const judges: string[] = []
  for (const line of managed) {
    if (/^Stage:/.test(line)) existingStage = line.replace(/^Stage:\s?/, '').trim() || undefined
    else if (/^•/.test(line)) judges.push(line.replace(/^•\s?/, '').trim())
  }

  const stage = opts.trackStage && info.stage ? info.stage : existingStage
  let outJudges = judges
  if (opts.trackJudges && info.judge) {
    if (judges.length === 0 || normJudge(judges[0]) !== normJudge(info.judge)) {
      outJudges = [info.judge, ...judges]
    }
  }

  const block: string[] = []
  if (stage) block.push(`Stage: ${stage}`)
  if (outJudges.length) {
    block.push('Judges:')
    for (const j of outJudges) block.push(`• ${j}`)
  }

  const restText = rest.join('\n')
  if (block.length === 0) return restText
  const blockText = block.join('\n')
  return restText.trim() ? `${blockText}\n\n${restText}` : blockText
}
