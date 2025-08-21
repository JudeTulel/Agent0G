import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import WalletConnect from './WalletConnect'
import { 
  Search, 
  Menu, 
  X, 
  Zap, 
  User, 
  Wallet,
  Settings
} from 'lucide-react'

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold">AI Agent Marketplace</span>
              <span className="text-xs text-muted-foreground">Powered by 0G Chain</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#marketplace" className="text-sm font-medium hover:text-primary transition-colors">
              Marketplace
            </a>
            <a href="#categories" className="text-sm font-medium hover:text-primary transition-colors">
              Categories
            </a>
            <a href="#developers" className="text-sm font-medium hover:text-primary transition-colors">
              Developers
            </a>
            <a href="#about" className="text-sm font-medium hover:text-primary transition-colors">
              About
            </a>
          </nav>

          {/* Search Bar - Desktop */}
          <div className="hidden lg:flex items-center space-x-4 flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search AI Agents..."
                className="pl-10 bg-muted/50"
              />
            </div>
          </div>

          {/* Wallet Connection & User Menu */}
          <div className="flex items-center space-x-4">
            {/* Wallet Connection */}
            <div className="hidden sm:block">
              <WalletConnect />
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={toggleMenu}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="lg:hidden pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search AI Agents..."
              className="pl-10 bg-muted/50"
            />
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t pt-4 pb-4 space-y-4">
            <nav className="flex flex-col space-y-3">
              <a href="#marketplace" className="text-sm font-medium hover:text-primary transition-colors">
                Marketplace
              </a>
              <a href="#categories" className="text-sm font-medium hover:text-primary transition-colors">
                Categories
              </a>
              <a href="#developers" className="text-sm font-medium hover:text-primary transition-colors">
                Developers
              </a>
              <a href="#about" className="text-sm font-medium hover:text-primary transition-colors">
                About
              </a>
            </nav>
            
            {/* Mobile Wallet Connection */}
            <div className="pt-4 border-t">
              <WalletConnect />
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header

