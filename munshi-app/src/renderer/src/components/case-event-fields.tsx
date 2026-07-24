import { useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CaseEventSpec, UpcomingEvent } from '../../../shared/types'

// Minutes before start; all-day events start at midnight.
const ALL_DAY_REMINDERS = [
  { value: '1440', label: '1 day before' },
  { value: '2880', label: '2 days before' },
  { value: '10080', label: '1 week before' },
  { value: 'none', label: 'No reminder' }
]
const TIMED_REMINDERS = [
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  ...ALL_DAY_REMINDERS
]

export interface CaseEventFieldsProps {
  spec: CaseEventSpec
  onSpecChange: (s: CaseEventSpec) => void
  linkedEventId: string | null
  onLinkedEventIdChange: (id: string | null) => void
}

export function CaseEventFields({
  spec,
  onSpecChange,
  linkedEventId,
  onLinkedEventIdChange
}: CaseEventFieldsProps): JSX.Element {
  const [events, setEvents] = useState<UpcomingEvent[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<CaseEventSpec>): void => onSpecChange({ ...spec, ...patch })

  const loadEvents = async (): Promise<void> => {
    if (events || loading) return
    setLoading(true)
    setError(null)
    try {
      setEvents(await window.api.listUpcomingEvents())
    } catch {
      setError('Could not load your events. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const reminders = spec.allDay ? ALL_DAY_REMINDERS : TIMED_REMINDERS

  return (
    <div className="event-fields">
      <div>
        <Label>Calendar event</Label>
        <p className="field-help">
          Munshi puts this event on the hearing date and moves it whenever the court changes
          the date.
        </p>
      </div>

      <Tabs
        defaultValue="create"
        onValueChange={(v) => {
          if (v === 'link') void loadEvents()
          else onLinkedEventIdChange(null)
        }}
      >
        <TabsList className="event-tabs-list">
          <TabsTrigger value="create">Create a new event</TabsTrigger>
          <TabsTrigger value="link">Use one I already have</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="event-tab-panel">
          <div className="field">
            <Label htmlFor="evtTitle">Event title</Label>
            <Input
              id="evtTitle"
              value={spec.title}
              placeholder="e.g. Party A vs Party B"
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>

          <div className="event-toggle-row">
            <div>
              <Label htmlFor="allDay">All-day event</Label>
              <p className="field-help">
                The court only publishes a date, not a time.
              </p>
            </div>
            <Switch
              id="allDay"
              checked={spec.allDay}
              onCheckedChange={(v) => {
                const validValues = (v ? ALL_DAY_REMINDERS : TIMED_REMINDERS).map((r) => r.value)
                const current = spec.reminderMins == null ? 'none' : String(spec.reminderMins)
                const reminderMins =
                  current === 'none' || validValues.includes(current) ? spec.reminderMins : 1440
                onSpecChange({ ...spec, allDay: v, reminderMins })
              }}
            />
          </div>

          {!spec.allDay && (
            <div className="event-time-grid">
              <div className="field">
                <Label htmlFor="startTime">Start time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={spec.startTime ?? '09:00'}
                  onChange={(e) => set({ startTime: e.target.value })}
                />
              </div>
              <div className="field">
                <Label htmlFor="duration">Length (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={5}
                  value={spec.durationMins ?? 60}
                  onChange={(e) =>
                    set({ durationMins: Math.max(5, parseInt(e.target.value, 10) || 60) })
                  }
                />
              </div>
            </div>
          )}

          <div className="field">
            <Label htmlFor="reminder">Remind me</Label>
            <Select
              value={spec.reminderMins == null ? 'none' : String(spec.reminderMins)}
              onValueChange={(v) => set({ reminderMins: v === 'none' ? null : parseInt(v, 10) })}
            >
              <SelectTrigger id="reminder">
                <SelectValue placeholder="Select a reminder" />
              </SelectTrigger>
              <SelectContent>
                {reminders.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="link" className="event-tab-panel-tight">
          <Label htmlFor="existing">Pick an event</Label>
          <p className="field-help">
            Munshi will take this event over and move it to the hearing date.
          </p>
          {loading && (
            <p className="event-loading">
              <Loader2 className="event-loading-glyph" /> Loading your events…
            </p>
          )}
          {error && !loading && (
            <div className="field">
              <p className="field-help">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null)
                  void loadEvents()
                }}
              >
                Try again
              </Button>
            </div>
          )}
          {events && events.length === 0 && !loading && !error && (
            <p className="field-help">
              No upcoming events found. Create a new one instead.
            </p>
          )}
          {events && events.length > 0 && (
            <Select value={linkedEventId ?? ''} onValueChange={(v) => onLinkedEventIdChange(v)}>
              <SelectTrigger id="existing">
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title}
                    {e.date ? ` — ${e.date}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
