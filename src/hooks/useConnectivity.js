import { useSyncExternalStore } from 'react'
import { getConnectivity, subscribeConnectivity } from '../services/connectivity'
import { getOutboxSummary, onOutboxChange } from '../services/syncQueue'

/** "online" | "offline" | "server_unreachable" */
export function useConnectivity() {
  return useSyncExternalStore(subscribeConnectivity, getConnectivity, () => 'online')
}

let cached = getOutboxSummary()
/** { pending, critical, syncing } for the offline write queue. */
export function useSyncStatus() {
  return useSyncExternalStore(
    (cb) => onOutboxChange((s) => { cached = s; cb() }),
    () => cached,
    () => cached
  )
}
