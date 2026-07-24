// Serialises sync and provisioning to avoid double-creating events.
export class Mutex {
  private tail: Promise<void> = Promise.resolve()

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.tail
    let release!: () => void
    this.tail = new Promise<void>((r) => (release = r))
    await prev
    try {
      return await fn()
    } finally {
      release()
    }
  }
}

export const calendarLock = new Mutex()
