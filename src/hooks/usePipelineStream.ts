import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { initialNodes, initialEdges, type PipelineState, type LogEntry, type NodeStatus } from '../types/pipeline'

// Fetch the initial state
const fetchInitialState = async (jobId: string): Promise<PipelineState> => {
  try {
    // In production, this hits the JobCoordinator DO directly or an API proxy
    const res = await fetch(`/api/jobs/${jobId}/stream`)
    if (res.ok) {
      return await res.json()
    }
  } catch (e) {
    console.warn('[usePipelineStream] Could not fetch initial state from backend, using defaults', e)
  }
  
  return {
    jobId,
    nodes: initialNodes,
    edges: initialEdges,
    logs: {},
  }
}

export function usePipelineStream(jobId: string) {
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)

  // 1. Fetch initial state using TanStack Query
  const { data, isLoading, error } = useQuery({
    queryKey: ['pipeline', jobId],
    queryFn: () => fetchInitialState(jobId),
    staleTime: Infinity, // State is driven by WebSockets, so don't auto-refetch
  })

  // 2. Setup Real WebSocket Listener
  useEffect(() => {
    if (!data) return // Wait for initial fetch

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/jobs/${jobId}/stream`
    
    let ws: WebSocket | null = null
    let reconnectTimer: NodeJS.Timeout

    const connect = () => {
      console.log(`[WebSocket] Connecting to ${wsUrl}`)
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log(`[WebSocket] Connected to stream for job ${jobId}`)
        setIsConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          queryClient.setQueryData(['pipeline', jobId], (old: PipelineState | undefined) => {
            if (!old) return old
            const newState = { ...old }

            if (msg.type === 'init') {
              return msg.state // Hydrate full state if DO sends it on connect
            }

            if (msg.type === 'node_update') {
              newState.nodes = newState.nodes.map(node => 
                node.id === msg.nodeId 
                  ? { 
                      ...node, 
                      data: { 
                        ...node.data, 
                        status: msg.status,
                        ...(msg.processedCount !== undefined ? { processedCount: msg.processedCount } : {}),
                        ...(msg.totalCount !== undefined ? { totalCount: msg.totalCount } : {}),
                        ...(msg.badge !== undefined ? { badge: msg.badge } : {})
                      } 
                    }
                  : node
              )
            } else if (msg.type === 'edge_update') {
              newState.edges = newState.edges.map(edge =>
                edge.id === msg.edgeId
                  ? { ...edge, animated: msg.animated, style: { ...edge.style, stroke: msg.color } }
                  : edge
              )
            } else if (msg.type === 'log') {
              const existingLogs = newState.logs[msg.nodeId] || []
              newState.logs = {
                ...newState.logs,
                [msg.nodeId]: [...existingLogs, msg.log]
              }
            }

            return newState
          })
        } catch (err) {
          console.error('[WebSocket] Failed to parse message', err)
        }
      }

      ws.onclose = () => {
        console.log(`[WebSocket] Disconnected from stream for job ${jobId}`)
        setIsConnected(false)
        // Simple reconnect logic
        reconnectTimer = setTimeout(connect, 3000)
      }

      ws.onerror = (err) => {
        console.error('[WebSocket] Error:', err)
        ws?.close()
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer)
      if (ws) {
        ws.onclose = null // Prevent reconnect on unmount
        ws.close()
      }
    }
  }, [data, jobId, queryClient])

  return {
    data,
    isLoading,
    error,
    isConnected,
  }
}
