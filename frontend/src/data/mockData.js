// Mock data for the AI Agent Marketplace

export const categories = [
  {
    id: 'chatbots',
    name: 'Chatbots',
    icon: '🤖',
    description: 'Conversational AI agents for customer support, assistance, and engagement',
    count: 156,
    color: 'purple'
  },
  {
    id: 'scrapers',
    name: 'Scrapers',
    icon: '🕷️',
    description: 'Data extraction and web scraping agents for automated information gathering',
    count: 89,
    color: 'blue'
  },
  {
    id: 'traders',
    name: 'Traders',
    icon: '📈',
    description: 'Algorithmic trading agents for cryptocurrency and financial markets',
    count: 67,
    color: 'green'
  },
  {
    id: 'analyzers',
    name: 'Analyzers',
    icon: '📊',
    description: 'Data analysis and insights agents for business intelligence and reporting',
    count: 43,
    color: 'orange'
  },
  {
    id: 'creators',
    name: 'Creators',
    icon: '🎨',
    description: 'Content creation agents for writing, design, and multimedia generation',
    count: 78,
    color: 'pink'
  },
  {
    id: 'assistants',
    name: 'Assistants',
    icon: '🤝',
    description: 'Personal and business assistant agents for productivity and task management',
    count: 92,
    color: 'teal'
  }
]

export const featuredAgents = [
  {
    id: 1,
    name: 'Code Mentor',
    description: 'Advanced AI coding assistant that helps developers write, debug, and optimize code across multiple programming languages with real-time suggestions.',
    category: 'chatbots',
    owner: 'DevMaster',
    pricePerUse: 0.05,
    subscriptionPrice: 2.5,
    rating: 480,
    reviewCount: 127,
    totalUsage: 15420,
    isActive: true,
    avatar: '/api/placeholder/64/64',
    tags: ['coding', 'debugging', 'optimization'],
    features: ['Multi-language support', 'Real-time suggestions', 'Code review'],
    createdAt: '2024-01-15',
    lastUpdated: '2024-03-10'
  },
  {
    id: 2,
    name: 'Market Analyzer',
    description: 'Sophisticated trading agent that analyzes market trends, identifies opportunities, and executes trades based on advanced algorithms and sentiment analysis.',
    category: 'traders',
    owner: 'CryptoWiz',
    pricePerUse: 0.1,
    subscriptionPrice: 5.0,
    rating: 460,
    reviewCount: 89,
    totalUsage: 8930,
    isActive: true,
    avatar: '/api/placeholder/64/64',
    tags: ['trading', 'analysis', 'automation'],
    features: ['Sentiment analysis', 'Risk management', 'Portfolio optimization'],
    createdAt: '2024-02-01',
    lastUpdated: '2024-03-12'
  },
  {
    id: 3,
    name: 'Trend Planner',
    description: 'Social media and content planning agent that analyzes trends, schedules posts, and optimizes engagement across multiple platforms.',
    category: 'creators',
    owner: 'SocialGuru',
    pricePerUse: 0.03,
    subscriptionPrice: 1.8,
    rating: 420,
    reviewCount: 156,
    totalUsage: 22100,
    isActive: true,
    avatar: '/api/placeholder/64/64',
    tags: ['social media', 'content', 'scheduling'],
    features: ['Multi-platform support', 'Trend analysis', 'Engagement optimization'],
    createdAt: '2024-01-20',
    lastUpdated: '2024-03-08'
  },
  {
    id: 4,
    name: 'Sales Ninja',
    description: 'High-performance sales automation agent that qualifies leads, manages pipelines, and closes deals with personalized communication strategies.',
    category: 'assistants',
    owner: 'SalesForce',
    pricePerUse: 0.08,
    subscriptionPrice: 4.2,
    rating: 490,
    reviewCount: 203,
    totalUsage: 31250,
    isActive: true,
    avatar: '/api/placeholder/64/64',
    tags: ['sales', 'automation', 'crm'],
    features: ['Lead qualification', 'Pipeline management', 'Personalized outreach'],
    createdAt: '2024-01-10',
    lastUpdated: '2024-03-15'
  },
  {
    id: 5,
    name: 'Data Harvester',
    description: 'Powerful web scraping agent that extracts structured data from websites, APIs, and databases with intelligent parsing and cleaning.',
    category: 'scrapers',
    owner: 'DataMiner',
    pricePerUse: 0.06,
    subscriptionPrice: 3.0,
    rating: 440,
    reviewCount: 78,
    totalUsage: 12800,
    isActive: true,
    avatar: '/api/placeholder/64/64',
    tags: ['scraping', 'data extraction', 'automation'],
    features: ['Intelligent parsing', 'Data cleaning', 'API integration'],
    createdAt: '2024-02-05',
    lastUpdated: '2024-03-11'
  },
  {
    id: 6,
    name: 'Insight Engine',
    description: 'Business intelligence agent that processes large datasets, generates reports, and provides actionable insights with advanced analytics.',
    category: 'analyzers',
    owner: 'AnalyticsPro',
    pricePerUse: 0.12,
    subscriptionPrice: 6.5,
    rating: 470,
    reviewCount: 134,
    totalUsage: 9870,
    isActive: true,
    avatar: '/api/placeholder/64/64',
    tags: ['analytics', 'reporting', 'insights'],
    features: ['Advanced analytics', 'Custom reports', 'Data visualization'],
    createdAt: '2024-01-25',
    lastUpdated: '2024-03-14'
  }
]

export const allAgents = [
  ...featuredAgents,
  {
    id: 7,
    name: 'Support Bot Pro',
    description: 'Customer support chatbot with natural language processing and multi-language support for 24/7 customer service.',
    category: 'chatbots',
    owner: 'SupportTech',
    pricePerUse: 0.02,
    subscriptionPrice: 1.2,
    rating: 380,
    reviewCount: 245,
    totalUsage: 45600,
    isActive: true,
    avatar: '/api/placeholder/64/64',
    tags: ['support', 'multilingual', 'nlp'],
    features: ['24/7 availability', 'Multi-language', 'Ticket integration'],
    createdAt: '2024-01-08',
    lastUpdated: '2024-03-09'
  },
  {
    id: 8,
    name: 'Price Monitor',
    description: 'E-commerce price monitoring agent that tracks competitor prices and alerts on changes for optimal pricing strategies.',
    category: 'scrapers',
    owner: 'EcomTracker',
    pricePerUse: 0.04,
    subscriptionPrice: 2.0,
    rating: 410,
    reviewCount: 67,
    totalUsage: 18900,
    isActive: true,
    avatar: '/api/placeholder/64/64',
    tags: ['ecommerce', 'pricing', 'monitoring'],
    features: ['Real-time alerts', 'Competitor analysis', 'Price history'],
    createdAt: '2024-02-12',
    lastUpdated: '2024-03-13'
  },
  {
    id: 9,
    name: 'Portfolio Guardian',
    description: 'Risk management trading agent that monitors portfolios, implements stop-losses, and rebalances investments automatically.',
    category: 'traders',
    owner: 'RiskManager',
    pricePerUse: 0.15,
    subscriptionPrice: 8.0,
    rating: 450,
    reviewCount: 92,
    totalUsage: 6750,
    isActive: true,
    avatar: '/api/placeholder/64/64',
    tags: ['risk management', 'portfolio', 'rebalancing'],
    features: ['Risk assessment', 'Auto-rebalancing', 'Stop-loss management'],
    createdAt: '2024-02-18',
    lastUpdated: '2024-03-16'
  },
  {
    id: 10,
    name: 'Content Wizard',
    description: 'AI writing assistant that creates blog posts, articles, and marketing copy with SEO optimization and brand voice consistency.',
    category: 'creators',
    owner: 'ContentKing',
    pricePerUse: 0.07,
    subscriptionPrice: 3.5,
    rating: 430,
    reviewCount: 178,
    totalUsage: 28400,
    isActive: true,
    avatar: '/api/placeholder/64/64',
    tags: ['writing', 'seo', 'marketing'],
    features: ['SEO optimization', 'Brand voice', 'Multiple formats'],
    createdAt: '2024-01-30',
    lastUpdated: '2024-03-07'
  }
]

export const userStats = {
  totalAgents: allAgents.length,
  activeAgents: allAgents.filter(agent => agent.isActive).length,
  totalCategories: categories.length,
  totalUsage: allAgents.reduce((sum, agent) => sum + agent.totalUsage, 0),
  averageRating: allAgents.reduce((sum, agent) => sum + agent.rating, 0) / allAgents.length / 100
}

export const recentActivity = [
  {
    id: 1,
    type: 'rental',
    user: 'Alice Johnson',
    agent: 'Code Mentor',
    action: 'rented',
    timestamp: '2024-03-16T10:30:00Z',
    amount: '0.05 ETH'
  },
  {
    id: 2,
    type: 'review',
    user: 'Bob Smith',
    agent: 'Market Analyzer',
    action: 'reviewed',
    timestamp: '2024-03-16T09:15:00Z',
    rating: 5
  },
  {
    id: 3,
    type: 'registration',
    user: 'Charlie Brown',
    agent: 'New Trading Bot',
    action: 'registered',
    timestamp: '2024-03-16T08:45:00Z'
  },
  {
    id: 4,
    type: 'usage',
    user: 'Diana Prince',
    agent: 'Trend Planner',
    action: 'used',
    timestamp: '2024-03-16T08:20:00Z',
    count: 3
  }
]

