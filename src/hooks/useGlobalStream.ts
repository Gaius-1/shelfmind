import { useEffect, useState } from 'react'

export interface StreamLog {
  id: string
  jobId: string
  nodeId: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  timestamp: string
}

export function useGlobalStream(activeJobIds: string[]) {
  const [logs, setLogs] = useState<StreamLog[]>([])

  useEffect(() => {
    if (activeJobIds.length === 0) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const sockets: WebSocket[] = []

    activeJobIds.forEach(jobId => {
      const wsUrl = `${protocol}//${window.location.host}/api/jobs/${jobId}/stream`
      const ws = new WebSocket(wsUrl)
      
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'log') {
            const newLog: StreamLog = {
              id: msg.log.id,
              jobId,
              nodeId: msg.nodeId,
              message: msg.log.message,
              type: msg.log.type,
              timestamp: msg.log.timestamp
            }
            // Keep last 30 logs globally
            setLogs(prev => {
              const updated = [newLog, ...prev]
              return updated.slice(0, 30)
            })
          }
        } catch (err) {
          // ignore parsing errors
        }
      }
      
      sockets.push(ws)
    })

    return () => {
      sockets.forEach(ws => {
        ws.onclose = null
        ws.close()
      })
    }
  }, [activeJobIds.join(',')]) // reconnect only if the list of active job IDs changes

  return logs
}
