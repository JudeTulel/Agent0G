import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const CategoryCard = ({ category, onClick }) => {
  const {
    name,
    icon,
    description,
    count,
    color
  } = category

  const getGradientClass = (color) => {
    const gradients = {
      purple: 'from-purple-500 to-purple-700',
      blue: 'from-blue-500 to-blue-700',
      green: 'from-green-500 to-green-700',
      orange: 'from-orange-500 to-orange-700',
      pink: 'from-pink-500 to-pink-700',
      teal: 'from-teal-500 to-teal-700',
      default: 'from-gray-500 to-gray-700'
    }
    return gradients[color] || gradients.default
  }

  return (
    <Card 
      className="group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-card to-card/50 backdrop-blur overflow-hidden"
      onClick={() => onClick(category)}
    >
      <CardContent className="p-6 relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full -translate-y-16 translate-x-16" />
        </div>

        <div className="relative z-10">
          {/* Icon */}
          <div className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${getGradientClass(color)} mb-4 group-hover:scale-110 transition-transform duration-300`}>
            <span className="text-2xl">{icon}</span>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg capitalize group-hover:text-primary transition-colors">
                {name}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {count} agents
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground line-clamp-2">
              {description}
            </p>
          </div>

          {/* Hover Effect Arrow */}
          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <svg 
                className="h-4 w-4 text-primary" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 5l7 7-7 7" 
                />
              </svg>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default CategoryCard

