import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Code, User } from 'lucide-react'

const ProfilePage = () => {
  const [userAgents, setUserAgents] = useState([])
  const [rentedAgents, setRentedAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [userAddress, setUserAddress] = useState('') // This should come from wallet connection

  useEffect(() => {
    if (userAddress) {
      fetchUserData()
    }
  }, [userAddress])

  const fetchUserData = async () => {
    setLoading(true)
    try {
      // Fetch user's agents
      const agentsResponse = await fetch(`http://localhost:3001/api/contracts/owners/${userAddress}/agents`)
      if (agentsResponse.ok) {
        const agentsData = await agentsResponse.json()
        setUserAgents(agentsData.agents || [])
      }

      // For rented agents, we would need an API endpoint to get rentals by user
      // For now, we'll show an empty list
      setRentedAgents([])
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUseAgent = (agent) => {
    // This would navigate to a workflow-like screen for using the agent
    console.log('Using agent:', agent)
    // TODO: Implement use agent functionality
  }

  if (loading) {
    return (
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <p>Loading profile...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Profile</h1>
        <p className="text-muted-foreground">
          Manage your AI agents and rentals
        </p>
      </div>

      <Tabs defaultValue="my-agents" className="space-y-6">
        <TabsList>
          <TabsTrigger value="my-agents">My Agents</TabsTrigger>
          <TabsTrigger value="rented-agents">Rented Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="my-agents" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Agents I've Created</h2>
            {userAgents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userAgents.map((agent) => (
                  <Card key={agent.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {agent.name}
                        <Badge variant="secondary">{agent.category}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {agent.description}
                      </p>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm">Price per use:</span>
                        <span className="font-medium">{agent.pricePerUse} ETH</span>
                      </div>
                      <Button
                        onClick={() => handleUseAgent(agent)}
                        className="w-full"
                        variant="outline"
                      >
                        Use Agent
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <div className="text-muted-foreground mb-4">
                    <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No agents created yet</p>
                    <p className="text-sm">Create your first AI agent in the workflow builder</p>
                  </div>
                  <Button onClick={() => window.location.href = '/workflow'}>
                    Create Agent
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rented-agents" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Agents I've Rented</h2>
            {rentedAgents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {rentedAgents.map((rental) => (
                  <Card key={rental.id}>
                    <CardHeader>
                      <CardTitle>{rental.agentName}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        Rented on {new Date(rental.rentedAt).toLocaleDateString()}
                      </p>
                      <Button
                        onClick={() => handleUseAgent(rental)}
                        className="w-full"
                      >
                        Use Agent
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <div className="text-muted-foreground mb-4">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No agents rented yet</p>
                    <p className="text-sm">Browse the marketplace to rent AI agents</p>
                  </div>
                  <Button onClick={() => window.location.href = '/marketplace'}>
                    Browse Marketplace
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  )
}

export default ProfilePage