import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Globe, 
  Mail, 
  Database, 
  Cloud, 
  Send,
  Server,
  HardDrive
} from 'lucide-react'

const ActionNode = ({ data, selected }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'http':
        return <Globe className="h-4 w-4" />
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'database':
        return <Database className="h-4 w-4" />
      case 'storage':
        return <Cloud className="h-4 w-4" />
      case 'webhook':
        return <Send className="h-4 w-4" />
      case 'api':
        return <Server className="h-4 w-4" />
      case 'file':
        return <HardDrive className="h-4 w-4" />
      default:
        return <Globe className="h-4 w-4" />
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'http':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'email':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'database':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300'
      case 'storage':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300'
      case 'webhook':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300'
      case 'api':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300'
      case 'file':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    }
  }

  const getEndpoint = (type, config) => {
    if (config?.url) return config.url
    if (config?.endpoint) return config.endpoint
    if (config?.to) return config.to
    
    switch (type) {
      case 'http':
        return 'https://api.example.com'
      case 'email':
        return 'user@example.com'
      case 'database':
        return 'postgresql://localhost:5432/db'
      case 'storage':
        return '0G Storage Network'
      default:
        return 'Not configured'
    }
  }

  return (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''} shadow-lg border-blue-200 dark:border-blue-800`}>
      <CardContent className="p-3">
        <div className="flex items-center space-x-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
            {getIcon(data.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{data.label}</div>
            <Badge variant="secondary" className={`text-xs ${getTypeColor(data.type)}`}>
              {data.type}
            </Badge>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground space-y-1">
          <div>
            <span className="font-medium">Endpoint:</span>
            <div className="truncate font-mono text-xs bg-muted px-1 rounded mt-1">
              {getEndpoint(data.type, data.config)}
            </div>
          </div>
          
          {data.config?.method && (
            <div className="flex items-center justify-between">
              <span>Method:</span>
              <Badge variant="outline" className="text-xs">
                {data.config.method}
              </Badge>
            </div>
          )}
          
          {data.config?.subject && (
            <div>
              <span className="font-medium">Subject:</span>
              <div className="truncate">{data.config.subject}</div>
            </div>
          )}
          
          {data.config?.query && (
            <div>
              <span className="font-medium">Query:</span>
              <div className="text-xs bg-muted p-1 rounded font-mono line-clamp-2">
                {data.config.query}
              </div>
            </div>
          )}
        </div>

        {/* Status indicator */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs text-muted-foreground">Ready</span>
          </div>
          {data.type === 'storage' && (
            <Badge variant="outline" className="text-xs">
              <Cloud className="h-3 w-3 mr-1" />
              0G Storage
            </Badge>
          )}
        </div>
      </CardContent>
      
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
    </Card>
  )
}

export default memo(ActionNode)

