import { describe, it, expect } from 'vitest'
import { Mutex } from './mutex'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('Mutex', () => {
  it('does not let two runExclusive calls interleave', async () => {
    const mutex = new Mutex()
    const order: string[] = []

    const task = (n: number): Promise<void> =>
      mutex.runExclusive(async () => {
        order.push(`start-${n}`)
        await delay(10)
        order.push(`end-${n}`)
      })

    await Promise.all([task(1), task(2)])

    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2'])
  })

  it('releases the lock when a queued task throws, so the next one still runs', async () => {
    const mutex = new Mutex()
    const order: string[] = []

    const failing = mutex.runExclusive(async () => {
      order.push('start-fail')
      await delay(5)
      throw new Error('boom')
    })

    const following = mutex.runExclusive(async () => {
      order.push('start-2')
      await delay(5)
      order.push('end-2')
      return 'done'
    })

    await expect(failing).rejects.toThrow('boom')
    await expect(following).resolves.toBe('done')

    expect(order).toEqual(['start-fail', 'start-2', 'end-2'])
  })

  it('passes the return value through', async () => {
    const mutex = new Mutex()
    const result = await mutex.runExclusive(async () => {
      await delay(1)
      return 42
    })
    expect(result).toBe(42)
  })

  it('preserves FIFO order across 3+ queued tasks', async () => {
    const mutex = new Mutex()
    const order: number[] = []

    const tasks = [1, 2, 3, 4, 5].map((n) =>
      mutex.runExclusive(async () => {
        await delay(Math.random() * 5)
        order.push(n)
      })
    )

    await Promise.all(tasks)

    expect(order).toEqual([1, 2, 3, 4, 5])
  })
})
