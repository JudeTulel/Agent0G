import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useBalance, useChainId, useSwitchChain } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { 
  Wallet, 
  ChevronDown, 
  Copy, 
  ExternalLink, 
  LogOut,
  AlertCircle,
  CheckCircle
} from 'lucide-react'

import { ogChain, ogTestnet, shortenAddress, getExplorerUrl, formatEther } from '../lib/blockchain'

const WalletConnect = () => {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({ address })
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  
  const [copied, setCopied] = useState(false)

  const isOnOGChain = chainId === ogChain.id || chainId === ogTestnet.id
  const currentChain = chainId === ogChain.id ? ogChain : ogTestnet

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const switchToOGChain = () => {
    switchChain({ chainId: ogTestnet.id })
  }

  if (!isConnected) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={isPending}>
            <Wallet className="h-4 w-4 mr-2" />
            {isPending ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="p-2">
            <div className="text-sm font-medium mb-2">Connect a Wallet</div>
            <div className="space-y-2">
              {connectors.map((connector) => (
                <Button
                  key={connector.id}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => connect({ connector })}
                  disabled={isPending}
                >
                  <Wallet className="h-4 w-4 mr-2" />
                  {connector.name}
                </Button>
              ))}
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            {isOnOGChain ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            )}
            <span className="font-mono text-sm">{shortenAddress(address)}</span>
          </div>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Wallet Connected</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Address */}
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Address</div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{shortenAddress(address)}</span>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyAddress}
                    className="h-6 w-6 p-0"
                  >
                    {copied ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(getExplorerUrl(chainId, address, 'address'), '_blank')}
                    className="h-6 w-6 p-0"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Balance */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Balance</div>
              <div className="text-sm font-medium">
                {balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}` : '0.0000 ETH'}
              </div>
            </div>

            {/* Network */}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Network</div>
              <div className="flex items-center justify-between">
                <Badge variant={isOnOGChain ? "default" : "secondary"}>
                  {isOnOGChain ? currentChain.name : 'Unsupported Network'}
                </Badge>
                {!isOnOGChain && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={switchToOGChain}
                    className="text-xs"
                  >
                    Switch to 0G
                  </Button>
                )}
              </div>
            </div>

            {/* Network Warning */}
            {!isOnOGChain && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="text-xs text-yellow-800 dark:text-yellow-200">
                    <div className="font-medium mb-1">Wrong Network</div>
                    <div>Please switch to 0G Chain to use the marketplace features.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => disconnect()} className="text-red-600">
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default WalletConnect

