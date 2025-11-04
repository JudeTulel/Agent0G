import React, { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Minimize2, Maximize2, X, Terminal, Copy, Trash2 } from 'lucide-react'
import useWorkflowStore from '../stores/workflowStore'

const ExecutionTerminal = () => {
  const [isMinimized, setIsMinimized] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const terminalRef = useRef(null)
  const logEndRef = useRef(null)

  const {
    executionLogs,
    isLogPanelOpen,
    setIsLogPanelOpen,
    clearLogs,
    isRunning
  } = useWorkflowStore()

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logEndRef.current && !isMinimized) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [executionLogs, isMinimized])

  const handleMouseDown = (e) => {
    if (e.target.closest('.no-drag')) return
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragStart])

  const copyLogs = () => {
    const logText = executionLogs.map(log => 
      typeof log === 'string' ? log : `[${log.timestamp?.toLocaleTimeString() || 'N/A'}] ${log.message}`
    ).join('\n')
    navigator.clipboard.writeText(logText)
  }

  const formatLogMessage = (log) => {
    const message = typeof log === 'string' ? log : log.message
    const timestamp = typeof log === 'string' ? '' : log.timestamp?.toLocaleTimeString()
    
    // Parse different log types for styling
    if (message.includes('❌')) {
      return { type: 'error', message, timestamp }
    } else if (message.includes('⚠️')) {
      return { type: 'warning', message, timestamp }
    } else if (message.includes('✅')) {
      return { type: 'success', message, timestamp }
    } else if (message.includes('🚀') || message.includes('🎉')) {
      return { type: 'important', message, timestamp }
    } else if (message.includes('▶️') || message.includes('📥') || message.includes('📤')) {
      return { type: 'info', message, timestamp }
    } else if (message.includes('🔗') || message.includes('🏁')) {
      return { type: 'flow', message, timestamp }
    }
    return { type: 'default', message, timestamp }
  }

  const getLogClassName = (type) => {
    switch (type) {
      case 'error':
        return 'text-red-400'
      case 'warning':
        return 'text-yellow-400'
      case 'success':
        return 'text-green-400'
      case 'important':
        return 'text-blue-400 font-semibold'
      case 'info':
        return 'text-cyan-400'
      case 'flow':
        return 'text-purple-400'
      default:
        return 'text-gray-300'
    }
  }

  if (!isLogPanelOpen) return null

  return (
    <div
      className="fixed z-50 select-none"
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? '300px' : '600px',
        height: isMinimized ? 'auto' : '400px'
      }}
      onMouseDown={handleMouseDown}
    >
      <Card className="bg-gray-900 text-green-400 border-gray-700 shadow-2xl font-mono overflow-hidden">
        <CardHeader className="pb-2 px-3 py-2 bg-gray-800 border-b border-gray-700 cursor-move">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Terminal className="h-4 w-4" />
              <CardTitle className="text-sm text-green-400">Workflow Execution Terminal</CardTitle>
              {isRunning && (
                <Badge variant="secondary" className="bg-blue-900 text-blue-300 animate-pulse">
                  Running
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-1 no-drag">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                onClick={copyLogs}
                title="Copy logs"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                onClick={clearLogs}
                title="Clear logs"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
                onClick={() => setIsLogPanelOpen(false)}
                title="Close"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {!isMinimized && (
          <CardContent className="p-0">
            <div 
              ref={terminalRef}
              className="h-full overflow-y-auto bg-gray-900 p-3 text-xs leading-relaxed"
              style={{ height: '352px' }}
            >
              {executionLogs.length === 0 ? (
                <div className="text-gray-500 italic">
                  Waiting for workflow execution...
                  <br />
                  Click "Run Workflow" to start.
                </div>
              ) : (
                <div className="space-y-1">
                  {executionLogs.map((log, index) => {
                    const formatted = formatLogMessage(log)
                    return (
                      <div key={index} className="flex items-start space-x-2">
                        <span className="text-gray-500 text-xs whitespace-nowrap">
                          {formatted.timestamp && `${formatted.timestamp}`}
                        </span>
                        <span className={`flex-1 ${getLogClassName(formatted.type)}`}>
                          {formatted.message}
                        </span>
                      </div>
                    )
                  })}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          </CardContent>
        )}
        
        {isMinimized && (
          <CardContent className="px-3 py-2">
            <div className="text-xs text-gray-400">
              {executionLogs.length} log entries
              {isRunning && <span className="ml-2 text-blue-400">• Running</span>}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

export default ExecutionTerminal