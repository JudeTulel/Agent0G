import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  GitBranch, 
  RotateCcw, 
  Variable, 
  Shuffle,
  Filter,
  Calculator,
  Code
} from 'lucide-react'

const LogicNode = ({ data, selected }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'condition':
        return <GitBranch className="h-4 w-4" />
      case 'loop':
        return <RotateCcw className="h-4 w-4" />
      case 'variable':
        return <Variable className="h-4 w-4" />
      case 'transform':
        return <Shuffle className="h-4 w-4" />
      case 'filter':
        return <Filter className="h-4 w-4" />
      case 'math':
        return <Calculator className="h-4 w-4" />
      case 'code':
        return <Code className="h-4 w-4" />
      default:
        return <GitBranch className="h-4 w-4" />
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'condition':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'loop':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
      case 'variable':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300'
      case 'transform':
        return 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-300'
      case 'filter':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300'
      case 'math':
        return 'bg-mint-100 text-mint-800 dark:bg-mint-900 dark:text-mint-300'
      case 'code':
        return 'bg-forest-100 text-forest-800 dark:bg-forest-900 dark:text-forest-300'
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    }
  }

  const getLogicDescription = (type, config) => {
    switch (type) {
      case 'condition':
        return config?.condition || 'if (condition) { ... }'
      case 'loop':
        return config?.type === 'for' ? `for (${config.iterations || 'n'} times)` : 'while (condition)'
      case 'variable':
        return config?.name ? `${config.name} = ${config.value || 'value'}` : 'variable = value'
      case 'transform':
        return config?.operation || 'transform data'
      case 'filter':
        return config?.criteria || 'filter by criteria'
      case 'math':
        return config?.expression || 'mathematical operation'
      case 'code':
        return config?.language || 'JavaScript'
      default:
        return 'logic operation'
    }
  }

  const hasMultipleOutputs = (type) => {
    return type === 'condition' || type === 'filter'
  }

  return (
    <Card className={`min-w-[200px] ${selected ? 'ring-2 ring-primary' : ''} shadow-lg border-green-200 dark:border-green-800`}>
      <CardContent className="p-3">
        <div className="flex items-center space-x-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 text-white">
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
            <span className="font-medium">Logic:</span>
            <div className="text-xs bg-muted p-2 rounded font-mono mt-1">
              {getLogicDescription(data.type, data.config)}
            </div>
          </div>
          
          {data.config?.timeout && (
            <div className="flex items-center justify-between">
              <span>Timeout:</span>
              <span className="font-mono text-xs">{data.config.timeout}ms</span>
            </div>
          )}
          
          {data.config?.maxIterations && (
            <div className="flex items-center justify-between">
              <span>Max Iterations:</span>
              <span className="font-mono text-xs">{data.config.maxIterations}</span>
            </div>
          )}
        </div>

        {/* Execution status */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs text-muted-foreground">Ready</span>
          </div>
          {hasMultipleOutputs(data.type) && (
            <Badge variant="outline" className="text-xs">
              Multi-path
            </Badge>
          )}
        </div>
      </CardContent>
      
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-green-500 border-2 border-white"
      />
      
      {hasMultipleOutputs(data.type) ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{ top: '30%' }}
            className="w-3 h-3 bg-green-500 border-2 border-white"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            style={{ top: '70%' }}
            className="w-3 h-3 bg-red-500 border-2 border-white"
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-green-500 border-2 border-white"
        />
      )}
    </Card>
  )
}

export default memo(LogicNode)

