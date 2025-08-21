import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Zap, Clock, Webhook } from 'lucide-react'

const TriggerNode = ({ data, selected }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'webhook':
        return <Webhook className="h-4 w-4" />
      case 'schedule':
        return <Clock className="h-4 w-4" />
      case 'event':
        return <Zap className="h-4 w-4" />
      default:
        return <Zap className="h-4 w-4" />
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'webhook':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'schedule':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      case 'event':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    }
  }

  return (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''} shadow-lg border-yellow-200 dark:border-yellow-800`}>
      <CardContent className="p-3">
        <div className="flex items-center space-x-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 text-white">
            {getIcon(data.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{data.label}</div>
            <Badge variant="secondary" className={`text-xs ${getTypeColor(data.type)}`}>
              {data.type}
            </Badge>
          </div>
        </div>
        
        {data.config && Object.keys(data.config).length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1">
            {data.type === 'webhook' && data.config.url && (
              <div className="truncate">URL: {data.config.url}</div>
            )}
            {data.type === 'schedule' && data.config.cron && (
              <div>Cron: {data.config.cron}</div>
            )}
            {data.type === 'event' && data.config.contract && (
              <div className="truncate">Contract: {data.config.contract}</div>
            )}
          </div>
        )}
      </CardContent>
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-yellow-500 border-2 border-white"
      />
    </Card>
  )
}

export default memo(TriggerNode)

