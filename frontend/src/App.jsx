import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Wrench,
  X,
  User
} from 'lucide-react'

import Header from './components/Header'
import AgentCard from './components/AgentCard'
import CategoryCard from './components/CategoryCard'
import WorkflowPage from './pages/WorkflowPage'
import MarketplacePage from './pages/MarketplacePage'
import ProfilePage from './pages/ProfilePage'
import UseAgentPage from './pages/UseAgentPage'
import { categories, featuredAgents, userStats } from './data/mockData'
import './App.css'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Header />
        
        <Routes>
          <Route path="/" element={<>
            <MarketplacePage />
            {/* Inline Workflow Builder below the marketplace as requested */}
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <WorkflowPage />
            </div>
          </>} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/use-agent/:agentId" element={<UseAgentPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
      