import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { CaseEventFields } from '@/components/case-event-fields'
import { DISTRICTS } from '../../../shared/districts'
import type { CaseEventSpec, CaseItem } from '../../../shared/types'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: CaseItem | null
  onSaved: (cases: CaseItem[]) => void
}

const newSpec = (): CaseEventSpec => ({
  title: '',
  useSiteTitle: true,
  allDay: true,
  reminderMins: 1440
})

export function CaseFormDialog({ open, onOpenChange, initial, onSaved }: Props): JSX.Element {
  const hasTrackedEvent = Boolean(initial?.trackedEventId)
  const [caseNumber, setCaseNumber] = useState('')
  const [district, setDistrict] = useState('Lahore')
  const [spec, setSpec] = useState<CaseEventSpec>(newSpec())
  const [linkedEventId, setLinkedEventId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [trackStage, setTrackStage] = useState(false)
  const [trackJudges, setTrackJudges] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const initialSpec = initial?.event ?? newSpec()
    setCaseNumber(initial?.caseNumber ?? '')
    setDistrict(initial?.district ?? 'Lahore')
    setSpec(initialSpec)
    setLinkedEventId(initial?.trackedEventId ?? null)
    setEnabled(initial?.enabled ?? true)
    setTrackStage(initial?.trackStage ?? false)
    setTrackJudges(initial?.trackJudges ?? false)
    setSavedId(initial?.id ?? null)
  }, [open, initial])

  const save = async (force = false): Promise<void> => {
    if (!caseNumber.trim()) {
      toast.error('Case number is required')
      return
    }

    setBusy(true)
    setBusyLabel('Saving…')
    try {
      const idToSave = savedId ?? initial?.id
      const cases = await window.api.saveCase({
        id: idToSave,
        caseNumber: caseNumber.trim(),
        district,
        enabled,
        event: { ...spec, title: spec.title.trim() },
        trackedEventId: linkedEventId,
        trackStage,
        trackJudges
      })

      const saved = idToSave
        ? cases.find((c) => c.id === idToSave)
        : cases.find((c) => c.caseNumber === caseNumber.trim() && c.district === district)
      if (!saved) {
        toast.error('Could not save', {
          description: "Something went wrong and we couldn't find the saved case. Please try again."
        })
        onSaved(cases)
        onOpenChange(false)
        return
      }
      setSavedId(saved.id)

      setBusyLabel('Looking up the hearing date…')
      const res = await window.api.provisionCase(saved.id)
      const after = await window.api.listCases()
      onSaved(after)

      if (res.ok) {
        toast.success(initial ? 'Case updated' : 'Case added', { description: res.message })
        onOpenChange(false)
      } else if (force) {
        toast.warning('Saved, but no event yet', { description: res.message })
        onOpenChange(false)
      } else {
        toast.error('Could not set up this case', {
          description: `${res.message} You can fix the number, or use Save anyway.`
        })
      }
    } catch (e) {
      toast.error('Could not save', { description: (e as Error).message })
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="case-dialog">
        <DialogHeader>
          <DialogTitle>
            {initial ? `Edit — ${initial.titleFromSite ?? initial.caseNumber}` : 'Add a case'}
          </DialogTitle>
          <DialogDescription>
            Munshi checks this case every day and keeps its calendar event on the next hearing
            date.
          </DialogDescription>
        </DialogHeader>

        <div className="case-form">
          <div className="field">
            <Label htmlFor="caseNumber">Case number</Label>
            <Input
              id="caseNumber"
              placeholder="e.g. 100200300"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
            />
            <p className="field-help">
              The number you use to look up this case on the court website.
            </p>
          </div>

          <div className="field">
            <Label htmlFor="district">District</Label>
            <Select value={district} onValueChange={setDistrict}>
              <SelectTrigger id="district">
                <SelectValue placeholder="Select district" />
              </SelectTrigger>
              <SelectContent>
                {DISTRICTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="field-help">
              The district whose court is hearing this case.
            </p>
          </div>

          {hasTrackedEvent ? (
            <div className="panel">
              <Label>Calendar event</Label>
              <p className="field-note">
                This case&apos;s event is in your Google Calendar. Edit it there — Munshi keeps
                your changes and moves the event when the court changes the date.
              </p>
            </div>
          ) : (
            <>
              <CaseEventFields
                spec={spec}
                onSpecChange={setSpec}
                linkedEventId={linkedEventId}
                onLinkedEventIdChange={setLinkedEventId}
                titleFromSite={initial?.titleFromSite ?? null}
              />

              {linkedEventId && (
                <p className="field-help">
                  You picked an existing calendar event above, so Munshi will use that event&apos;s
                  own title and date. Anything typed under &quot;Create a new event&quot; will be
                  ignored.
                </p>
              )}
            </>
          )}

          <div className="panel-row">
            <div>
              <Label htmlFor="enabled">Check this case daily</Label>
              <p className="field-help">
                Turn off to pause it without deleting it.
              </p>
            </div>
            <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="panel-row">
            <div>
              <Label htmlFor="trackStage">Track case stage in the event</Label>
              <p className="field-help">
                Writes the current hearing stage at the top of the calendar event.
              </p>
            </div>
            <Switch id="trackStage" checked={trackStage} onCheckedChange={setTrackStage} />
          </div>

          <div className="panel-row">
            <div>
              <Label htmlFor="trackJudges">Track judge history in the event</Label>
              <p className="field-help">
                Keeps a list of the judges assigned to this case, newest first.
              </p>
            </div>
            <Switch id="trackJudges" checked={trackJudges} onCheckedChange={setTrackJudges} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => void save(true)} disabled={busy}>
            Save anyway
          </Button>
          <Button onClick={() => void save(false)} disabled={busy}>
            {busy && <Loader2 className="icon-leading is-spinning" />}
            {busy ? busyLabel : initial ? 'Save changes' : 'Add case'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
