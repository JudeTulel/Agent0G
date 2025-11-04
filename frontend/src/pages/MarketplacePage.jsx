import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Filter, TrendingUp, Users, Zap, Star, ArrowRight, Sparkles } from 'lucide-react'
import AgentCard from '../components/AgentCard'
import CategoryCard from '../components/CategoryCard'
import { categories, featuredAgents, allAgents, userStats } from '../data/mockData'

import { buildApiUrl } from '../lib/compute'

const MarketplacePage = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('popular')
  const [priceFilter, setPriceFilter] = useState('all')
  const [agents, setAgents] = useState([])
  const [loadingAgents, setLoadingAgents] = useState(true)

  // Fetch agents from API
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch(buildApiUrl('/api/contracts/agents'))
        if (response.ok) {
          const data = await response.json()
          // Transform API data to match component expectations
          const transformedAgents = data.agents.map(agent => ({
            id: agent.id,
            name: agent.name,
            description: agent.description,
            category: agent.category,
            owner: agent.owner || 'Unknown',
            pricePerUse: agent.pricePerUse,
            subscriptionPrice: agent.subscriptionPrice,
            rating: agent.rating || 0,
            reviewCount: agent.reviewCount || 0,
            totalUsage: agent.totalUsage || 0,
            isActive: agent.isActive !== false,
            avatar: '/api/placeholder/64/64',
            tags: agent.tags || [],
            features: agent.features || [],
            createdAt: agent.createdAt || new Date().toISOString(),
            lastUpdated: agent.lastUpdated || new Date().toISOString()
          }))
          setAgents(transformedAgents)
        } else {
          console.error('Failed to fetch agents')
          // Fallback to mock data if API fails
          setAgents(allAgents)
        }
      } catch (error) {
        console.error('Error fetching agents:', error)
        // Fallback to mock data if API fails
        setAgents(allAgents)
      } finally {
        setLoadingAgents(false)
      }
    }

    fetchAgents()
  }, [])

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let filtered = agents

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
  }, [searchQuery, selectedCategory, sortBy, priceFilter, agents])

  const handleCategoryClick = (category) => {
    setSelectedCategory(category.id)
  }

  const handleAgentRent = async (agent) => {
    try {
      const response = await fetch(buildApiUrl(`/api/contracts/agents/${agent.id}/rent`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value: agent.pricePerUse
        })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Agent rented successfully!\nRental ID: ${result.rentalId}\nTX: ${result.txHash}`)
      } else {
        const error = await response.json()
        alert(`Failed to rent agent: ${error.error}`)
      }
    } catch (error) {
      console.error('Error renting agent:', error)
      alert('Error renting agent')
    }
  }

  const handleAgentDetails = (agent) => {
    // This will be handled by navigation to agent details page
    console.log('Viewing agent details:', agent)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <section className="text-center py-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-teal-600/10 rounded-3xl" />
          <div className="relative z-10">
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              <span>AI Agent Marketplace</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Discover the Future of
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600"> AI Automation</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              From chatbots to trading algorithms, find the perfect AI solution on our decentralized marketplace.
            </p>

            {/* Search Bar */}
            <div className="max-w-md mx-auto mb-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search AI Agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-lg"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{userStats.totalAgents}</div>
                <div className="text-sm text-muted-foreground">AI Agents</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{userStats.totalUsers}</div>
                <div className="text-sm text-muted-foreground">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{userStats.totalTransactions}</div>
                <div className="text-sm text-muted-foreground">Transactions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{userStats.totalVolume}</div>
                <div className="text-sm text-muted-foreground">Volume (ETH)</div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Browse by Category</h2>
            <p className="text-muted-foreground">Find agents tailored to your specific needs</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                onClick={() => handleCategoryClick(category)}
                isSelected={selectedCategory === category.id}
              />
            ))}
          </div>
        </section>

        {/* Agents Section */}
        <section className="py-16">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Featured Agents</h2>
              <p className="text-muted-foreground">Discover trending AI agents in our marketplace</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mt-4 md:mt-0">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Popular</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price-low">Price: Low</SelectItem>
                  <SelectItem value="price-high">Price: High</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priceFilter} onValueChange={setPriceFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Prices</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="low">Low (≤0.05)</SelectItem>
                  <SelectItem value="medium">Medium (0.05-0.1)</SelectItem>
                  <SelectItem value="high">High (`&gt;`0.1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingAgents ? (
            <div className="text-center py-16">
              <p>Loading agents...</p>
            </div>
          ) : (
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
          )}

          {filteredAgents.length === 0 && !loadingAgents && (
            <Card className="text-center py-12">
              <CardContent>
                <div className="text-muted-foreground mb-4">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No agents found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
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

export default MarketplacePage