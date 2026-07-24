import type { MunshiApi } from '../../shared/types'

declare global {
  interface Window {
    api: MunshiApi
  }
}

export {}
