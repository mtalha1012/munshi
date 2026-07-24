import { useEffect, useState } from 'react'
import { Play, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { SyncRunResult, SyncProgress } from '../../../shared/types'

// Older runs may lack some counts; default them to 0.
function safeCounts(summary: SyncRunResult['summary']): {
  processed: number
  added: number
  moved: number
  recreated: number
  skipped: number
  failed: number
} {
  return {
    processed: summary.processed ?? 0,
    added: summary.added ?? 0,
    moved: summary.moved ?? 0,
    recreated: summary.recreated ?? 0,
    skipped: summary.skipped ?? 0,
    failed: summary.failed ?? 0
  }
}

function summarizeCounts(summary: SyncRunResult['summary']): string {
  const { added, moved, recreated, skipped, failed } = safeCounts(summary)
  const parts: string[] = []
  if (added > 0) parts.push(`Added ${added}`)
  if (moved > 0) parts.push(`moved ${moved}`)
  if (recreated > 0) parts.push(`re-created ${recreated}`)
  if (skipped > 0) parts.push(`already there ${skipped}`)
  if (failed > 0) parts.push(`failed ${failed}`)
  if (parts.length === 0) return 'Nothing to do'

  const [first, ...rest] = parts
  return [first[0].toUpperCase() + first.slice(1), ...rest].join(', ')
}

export function ActivityView(): JSX.Element {
  const [lastRun, setLastRun] = useState<SyncRunResult | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<SyncProgress | null>(null)

  useEffect(() => {
    void window.api.getLastRun().then(setLastRun)
    const off = window.api.onSyncProgress((p) => {
      setProgress(p)
      if (p.phase === 'done') {
        setRunning(false)
        void window.api.getLastRun().then(setLastRun)
      } else {
        setRunning(true)
      }
    })
    return off
  }, [])

  const runNow = async (): Promise<void> => {
    setRunning(true)
    setProgress({ phase: 'start', message: 'Starting…' })
    try {
      const run = await window.api.runNow()
      setLastRun(run)
      toast.success('Sync complete', { description: summarizeCounts(run.summary) })
    } catch (e) {
      toast.error('Sync failed', { description: (e as Error).message })
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  const fmt = (iso?: string): string => (iso ? new Date(iso).toLocaleString() : '—')
  const counts = lastRun ? safeCounts(lastRun.summary) : null

  return (
    <div className="activity-view">
      <div className="activity-toolbar">
        <div>
          <h2 className="activity-heading">Activity</h2>
          <p className="activity-subheading">
            Munshi runs on its own once a day. You can also run it now.
          </p>
        </div>
        <Button onClick={runNow} disabled={running}>
          {running ? <Loader2 className="icon-leading is-spinning" /> : <Play className="icon-leading" />}
          {running ? 'Syncing…' : 'Run now'}
        </Button>
      </div>

      {running && progress ? (
        <Card role="status" aria-live="polite">
          <CardContent className="activity-progress">
            <Loader2 className="activity-progress-glyph" />
            <span className="activity-progress-text">
              {progress.message}
              {progress.total ? ` (${progress.current}/${progress.total})` : ''}
            </span>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="activity-card-title">Last run</CardTitle>
          <CardDescription className="activity-card-meta">
            <Clock className="activity-clock-glyph" />
            {lastRun ? fmt(lastRun.finishedAt) : 'Not run yet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="activity-card-body">
          {!lastRun || !counts ? (
            <p className="activity-placeholder">
              No sync has run yet. Add your cases, then press &quot;Run now&quot; or wait for the
              daily run.
            </p>
          ) : (
            <>
              <div className="activity-badges">
                <Badge variant="secondary">Processed {counts.processed}</Badge>
                <Badge variant="secondary">Added {counts.added}</Badge>
                {counts.moved > 0 ? <Badge variant="outline">Moved {counts.moved}</Badge> : null}
                {counts.recreated > 0 ? (
                  <Badge variant="outline">Re-created {counts.recreated}</Badge>
                ) : null}
                <Badge variant="outline">Already there {counts.skipped}</Badge>
                {counts.failed > 0 ? (
                  <Badge variant="destructive">Failed {counts.failed}</Badge>
                ) : null}
              </div>

              <div className="activity-results">
                {lastRun.results.length === 0 ? (
                  <p className="activity-results-empty">No enabled cases.</p>
                ) : (
                  lastRun.results.map((r) => (
                    <div key={r.caseId} className="activity-result">
                      {r.ok ? (
                        <CheckCircle2 className="activity-result-ok" />
                      ) : (
                        <XCircle className="activity-result-fail" />
                      )}
                      <div className="activity-result-body">
                        <div className="activity-result-case">{r.caseNumber}</div>
                        <div className="activity-result-message">{r.message}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
