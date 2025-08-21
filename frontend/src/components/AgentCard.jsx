import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Star, 
  Users, 
  Zap, 
  Clock,
  DollarSign,
  TrendingUp
} from 'lucide-react'

const AgentCard = ({ agent, onRent, onViewDetails }) => {
  const {
    id,
    name,
    description,
    category,
    owner,
    pricePerUse,
    subscriptionPrice,
    rating,
    reviewCount,
    totalUsage,
    isActive,
    avatar
  } = agent

  const formatPrice = (price) => {
    if (price >= 1) return `${price} ETH`
    return `${(price * 1000).toFixed(0)}m ETH`
  }

  const getCategoryColor = (category) => {
    const colors = {
      chatbot: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      scraper: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      trader: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      analyzer: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      default: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
    return colors[category] || colors.default
  }

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'chatbot':
        return '🤖'
      case 'scraper':
        return '🕷️'
      case 'trader':
        return '📈'
      case 'analyzer':
        return '📊'
      default:
        return '⚡'
    }
  }

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-card to-card/50 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="h-12 w-12 border-2 border-primary/20">
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-bold">
                  {getCategoryIcon(category)}
                </AvatarFallback>
              </Avatar>
              {isActive && (
                <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-white rounded-full animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                {name}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                by {owner}
              </p>
            </div>
          </div>
          <Badge className={getCategoryColor(category)} variant="secondary">
            {category}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-4">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {description}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <span className="text-sm font-medium">
              {rating > 0 ? (rating / 100).toFixed(1) : 'New'}
            </span>
            <span className="text-xs text-muted-foreground">
              ({reviewCount})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">
              {totalUsage.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">uses</span>
          </div>
        </div>

        {/* Pricing */}
        <div className="space-y-2">
          {pricePerUse > 0 && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Pay per use</span>
              </div>
              <span className="text-sm font-bold text-primary">
                {formatPrice(pricePerUse)}
              </span>
            </div>
          )}
          {subscriptionPrice > 0 && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Monthly</span>
              </div>
              <span className="text-sm font-bold text-primary">
                {formatPrice(subscriptionPrice)}
              </span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-0 space-x-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={() => onViewDetails(agent)}
        >
          View Details
        </Button>
        <Button 
          size="sm" 
          className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          onClick={() => onRent(agent)}
          disabled={!isActive}
        >
          <DollarSign className="h-4 w-4 mr-1" />
          Rent
        </Button>
      </CardFooter>
    </Card>
  )
}

export default AgentCard

