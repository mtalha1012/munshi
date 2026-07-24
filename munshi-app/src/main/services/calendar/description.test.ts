import { describe, it, expect } from 'vitest'
import { applyManagedDescription } from './description'

const both = { trackStage: true, trackJudges: true }

describe('applyManagedDescription — fresh block', () => {
  it('adds stage and judge to an empty description', () => {
    const out = applyManagedDescription(undefined, { stage: 'Argument', judge: 'A. Judge' }, both)
    expect(out).toBe('Stage: Argument\nJudges:\n• A. Judge')
  })

  it('prepends a block above existing user notes, preserving them', () => {
    const out = applyManagedDescription(
      'Bring the affidavit.\nSecond line.',
      { stage: 'Argument', judge: 'A. Judge' },
      both
    )
    expect(out).toBe('Stage: Argument\nJudges:\n• A. Judge\n\nBring the affidavit.\nSecond line.')
  })

  it('returns the description unchanged when nothing is tracked', () => {
    const out = applyManagedDescription('My notes', { stage: 'Argument', judge: 'A. Judge' }, {
      trackStage: false,
      trackJudges: false
    })
    expect(out).toBe('My notes')
  })

  it('returns empty string for an empty description with nothing to add', () => {
    expect(applyManagedDescription(undefined, {}, both)).toBe('')
  })
})

describe('applyManagedDescription — stage updates', () => {
  it('overwrites the stage line with the current stage', () => {
    const prev = 'Stage: Notice\nJudges:\n• A. Judge\n\nnotes'
    const out = applyManagedDescription(prev, { stage: 'Argument', judge: 'A. Judge' }, both)
    expect(out).toBe('Stage: Argument\nJudges:\n• A. Judge\n\nnotes')
  })

  it('keeps the existing stage when the scrape has no stage', () => {
    const prev = 'Stage: Notice\n\nnotes'
    const out = applyManagedDescription(prev, { judge: undefined }, both)
    expect(out).toBe('Stage: Notice\n\nnotes')
  })

  it('stage only, no judges', () => {
    expect(applyManagedDescription(undefined, { stage: 'Argument' }, both)).toBe('Stage: Argument')
  })
})

describe('applyManagedDescription — judge history', () => {
  it('prepends a new judge when it differs from the newest', () => {
    const prev = 'Stage: Argument\nJudges:\n• Old Judge\n\nnotes'
    const out = applyManagedDescription(prev, { stage: 'Argument', judge: 'New Judge' }, both)
    expect(out).toBe('Stage: Argument\nJudges:\n• New Judge\n• Old Judge\n\nnotes')
  })

  it('does nothing when the current judge equals the newest (case/space-insensitive)', () => {
    const prev = 'Judges:\n• A.  Judge'
    const out = applyManagedDescription(prev, { judge: 'a. judge' }, {
      trackStage: false,
      trackJudges: true
    })
    expect(out).toBe('Judges:\n• A.  Judge')
  })

  it('judge only, no stage', () => {
    expect(applyManagedDescription(undefined, { judge: 'A. Judge' }, both)).toBe(
      'Judges:\n• A. Judge'
    )
  })
})

describe('applyManagedDescription — safety', () => {
  it('does not treat a "Stage:" line in user notes as the managed block', () => {
    const prev = 'My notes\nStage: this is my own text'
    const out = applyManagedDescription(prev, { stage: 'Argument', judge: 'A. Judge' }, both)
    expect(out).toBe('Stage: Argument\nJudges:\n• A. Judge\n\nMy notes\nStage: this is my own text')
  })

  it('is idempotent — re-applying the same info changes nothing', () => {
    const first = applyManagedDescription('user text', { stage: 'Argument', judge: 'A. Judge' }, both)
    const second = applyManagedDescription(first, { stage: 'Argument', judge: 'A. Judge' }, both)
    expect(second).toBe(first)
  })

  it('preserves user notes that contain blank lines', () => {
    const prev = 'para one\n\npara two'
    const out = applyManagedDescription(prev, { stage: 'Argument' }, both)
    expect(out).toBe('Stage: Argument\n\npara one\n\npara two')
    // and round-trips
    expect(applyManagedDescription(out, { stage: 'Argument' }, both)).toBe(out)
  })

  it('when tracking is off, existing managed lines are preserved (non-destructive)', () => {
    const prev = 'Stage: Notice\nJudges:\n• A. Judge\n\nnotes'
    const out = applyManagedDescription(prev, { stage: 'Argument', judge: 'B. Judge' }, {
      trackStage: false,
      trackJudges: false
    })
    expect(out).toBe(prev)
  })
})
