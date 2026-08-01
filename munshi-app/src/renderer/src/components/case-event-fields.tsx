import { useEffect, useState } from 'react'
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

// How far back the "Past" picker looks. 'all' means no lower bound.
const LOOKBACKS = [
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
  { value: 'all', label: 'All time' }
]
const toMonths = (v: string): number | null => (v === 'all' ? null : parseInt(v, 10))

const LOAD_ERROR = 'Could not load your events. Check your connection and try again.'

// The loading / error / empty / list states shared by both event tabs.
// Composes shadcn primitives only.
function EventPicker({
  id,
  events,
  loading,
  error,
  emptyText,
  value,
  onChange,
  onRetry
}: {
  id: string
  events: UpcomingEvent[] | null
  loading: boolean
  error: string | null
  emptyText: string
  value: string | null
  onChange: (id: string) => void
  onRetry: () => void
}): JSX.Element | null {
  if (loading) {
    return (
      <p className="event-loading">
        <Loader2 className="event-loading-glyph" /> Loading your events…
      </p>
    )
  }
  if (error) {
    return (
      <div className="field">
        <p className="field-help">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    )
  }
  if (!events) return null
  if (events.length === 0) return <p className="field-help">{emptyText}</p>
  return (
    <Select value={value ?? ''} onValueChange={onChange}>
      <SelectTrigger id={id}>
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
  )
}

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
  const [upcoming, setUpcoming] = useState<UpcomingEvent[] | null>(null)
  const [past, setPast] = useState<UpcomingEvent[] | null>(null)
  const [upcomingLoading, setUpcomingLoading] = useState(false)
  const [pastLoading, setPastLoading] = useState(false)
  const [upcomingError, setUpcomingError] = useState<string | null>(null)
  const [pastError, setPastError] = useState<string | null>(null)
  const [lookback, setLookback] = useState('6')

  const set = (patch: Partial<CaseEventSpec>): void => onSpecChange({ ...spec, ...patch })

  // Restore the saved lookback so the Past tab opens where the user left it.
  useEffect(() => {
    void window.api.getSettings().then((s) => {
      setLookback(s.pastLookbackMonths === null ? 'all' : String(s.pastLookbackMonths ?? 6))
    })
  }, [])

  const loadUpcoming = async (force = false): Promise<void> => {
    if ((upcoming && !force) || upcomingLoading) return
    setUpcomingLoading(true)
    setUpcomingError(null)
    try {
      setUpcoming(await window.api.listUpcomingEvents())
    } catch {
      setUpcomingError(LOAD_ERROR)
    } finally {
      setUpcomingLoading(false)
    }
  }

  const loadPast = async (months: string, force = false): Promise<void> => {
    if ((past && !force) || pastLoading) return
    setPastLoading(true)
    setPastError(null)
    try {
      setPast(await window.api.listPastEvents(toMonths(months)))
    } catch {
      setPastError(LOAD_ERROR)
    } finally {
      setPastLoading(false)
    }
  }

  // A new range means a different list, so drop any selection made from the old one.
  const changeLookback = (v: string): void => {
    setLookback(v)
    onLinkedEventIdChange(null)
    void window.api.setSettings({ pastLookbackMonths: toMonths(v) })
    void loadPast(v, true)
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
          // The link panel opens on its Upcoming tab.
          if (v === 'link') void loadUpcoming()
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
          <Tabs
            defaultValue="upcoming"
            onValueChange={(v) => {
              // Each tab has its own list, so a selection can't carry across.
              onLinkedEventIdChange(null)
              if (v === 'upcoming') void loadUpcoming()
              else void loadPast(lookback)
            }}
          >
            <TabsList className="event-tabs-list">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="event-tab-panel-tight">
              <Label htmlFor="existingUpcoming">Pick an event</Label>
              <p className="field-help">
                Munshi will take this event over and move it to the hearing date.
              </p>
              <EventPicker
                id="existingUpcoming"
                events={upcoming}
                loading={upcomingLoading}
                error={upcomingError}
                emptyText="No upcoming events found. Try the Past tab, or create a new one."
                value={linkedEventId}
                onChange={onLinkedEventIdChange}
                onRetry={() => void loadUpcoming(true)}
              />
            </TabsContent>

            <TabsContent value="past" className="event-tab-panel-tight">
              <Label htmlFor="existingPast">Pick an event</Label>
              <p className="field-help">
                Munshi leaves this event where it is and creates the next hearing from it,
                keeping its title and reminder.
              </p>
              <div className="field">
                <Label htmlFor="lookback">How far back to look</Label>
                <Select value={lookback} onValueChange={changeLookback}>
                  <SelectTrigger id="lookback">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOOKBACKS.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <EventPicker
                id="existingPast"
                events={past}
                loading={pastLoading}
                error={pastError}
                emptyText="No past events found in this period. Try a longer range."
                value={linkedEventId}
                onChange={onLinkedEventIdChange}
                onRetry={() => void loadPast(lookback, true)}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  )
}
