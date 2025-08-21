import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import Header from './components/Header'
import AgentCard from './components/AgentCard'
import CategoryCard from './components/CategoryCard'
import WorkflowPage from './pages/WorkflowPage'

import { categories, featuredAgents, allAgents, userStats } from './data/mockData'

import { 
  Search, 
  Filter,
  TrendingUp,
  Users,
  Zap,
  Star,
  ArrowRight,
  Sparkles,
  Code,
  Wrench
} from 'lucide-react'

import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('marketplace')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('popular')
  const [priceFilter, setPriceFilter] = useState('all')

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let filtered = allAgents

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(agent =>
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(agent => agent.category === selectedCategory)
    }

    // Price filter
    if (priceFilter !== 'all') {
      filtered = filtered.filter(agent => {
        const price = agent.pricePerUse
        switch (priceFilter) {
          case 'free':
            return price === 0
          case 'low':
            return price > 0 && price <= 0.05
          case 'medium':
            return price > 0.05 && price <= 0.1
          case 'high':
            return price > 0.1
          default:
            return true
        }
      })
    }

    // Sort
    switch (sortBy) {
      case 'popular':
        return filtered.sort((a, b) => b.totalUsage - a.totalUsage)
      case 'rating':
        return filtered.sort((a, b) => b.rating - a.rating)
      case 'newest':
        return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      case 'price-low':
        return filtered.sort((a, b) => a.pricePerUse - b.pricePerUse)
      case 'price-high':
        return filtered.sort((a, b) => b.pricePerUse - a.pricePerUse)
      default:
        return filtered
    }
  }, [searchQuery, selectedCategory, sortBy, priceFilter])

  const handleCategoryClick = (category) => {
    setSelectedCategory(category.id)
  }

  const handleAgentRent = (agent) => {
    console.log('Renting agent:', agent)
    // TODO: Implement rental logic
  }

  const handleAgentDetails = (agent) => {
    console.log('Viewing agent details:', agent)
    // TODO: Implement agent details modal/page
  }

  const navigateToWorkflowBuilder = () => {
    setCurrentPage('workflow')
  }

  const navigateToMarketplace = () => {
    setCurrentPage('marketplace')
  }

  if (currentPage === 'workflow') {
    return <WorkflowPage onBack={navigateToMarketplace} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <section className="text-center py-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-teal-600/10 rounded-3xl" />
          <div className="relative z-10">
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              <span>Powered by 0G Chain</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 bg-clip-text text-transparent mb-6">
              Browse AI Agents
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Discover, rent, and deploy powerful AI agents for your business needs. 
              From chatbots to trading algorithms, find the perfect AI solution on our decentralized marketplace.
            </p>
            
            {/* Action Buttons */}
            <div className="flex items-center justify-center space-x-4 mb-8">
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                <Zap className="h-5 w-5 mr-2" />
                Browse Agents
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={navigateToWorkflowBuilder}
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Code className="h-5 w-5 mr-2" />
                Create Workflow
              </Button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{userStats.totalAgents}</div>
                <div className="text-sm text-muted-foreground">Total Agents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{userStats.activeAgents}</div>
                <div className="text-sm text-muted-foreground">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{userStats.totalUsage.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Uses</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{userStats.averageRating.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Avg Rating</div>
              </div>
            </div>
          </div>
        </section>

        {/* Developer Tools Section */}
        <section className="mb-12">
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                    <Wrench className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Build Your Own AI Agent</h3>
                    <p className="text-muted-foreground max-w-md">
                      Use our visual workflow builder to create custom AI agents with drag-and-drop simplicity. 
                      Deploy directly to 0G Chain and monetize your creations.
                    </p>
                  </div>
                </div>
                <Button 
                  size="lg" 
                  onClick={navigateToWorkflowBuilder}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  <Code className="h-5 w-5 mr-2" />
                  Open Builder
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Categories Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">Categories</h2>
            <Button variant="ghost" className="group">
              View All
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onClick={handleCategoryClick}
              />
            ))}
          </div>
        </section>

        {/* Featured Agents Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Featured Agents</h2>
              <p className="text-muted-foreground">Top-rated and most popular AI agents</p>
            </div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <Badge variant="secondary">Trending</Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredAgents.slice(0, 6).map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onRent={handleAgentRent}
                onViewDetails={handleAgentDetails}
              />
            ))}
          </div>
        </section>

        {/* All Agents Section */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold">All Agents</h2>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{filteredAgents.length} agents found</span>
            </div>
          </div>

          {/* Filters */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Filter className="h-5 w-5" />
                <span>Filters</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search agents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Category Filter */}
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Price Filter */}
                <Select value={priceFilter} onValueChange={setPriceFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Price Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Prices</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="low">Low (≤0.05 ETH)</SelectItem>
                    <SelectItem value="medium">Medium (0.05-0.1 ETH)</SelectItem>
                    <SelectItem value="high">High (>0.1 ETH)</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Agents Grid */}
          {filteredAgents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onRent={handleAgentRent}
                  onViewDetails={handleAgentDetails}
                />
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <div className="text-muted-foreground mb-4">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No agents found</p>
                  <p className="text-sm">Try adjusting your search criteria</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedCategory('all')
                    setPriceFilter('all')
                  }}
                >
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  )
}

export default App

