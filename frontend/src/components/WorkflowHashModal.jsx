import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog'
import { Button } from './ui/button'
import { Copy } from 'lucide-react'

export default function WorkflowHashModal({ isOpen, onClose, rootHash }) {
  const handleCopy = () => {
    if (rootHash) {
      navigator.clipboard.writeText(rootHash)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workflow Saved to 0G Storage</DialogTitle>
          <DialogDescription>
            Your workflow has been saved. Here is the root hash:
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 mt-4 mb-2">
          <code className="bg-muted px-2 py-1 rounded text-xs break-all">{rootHash}</code>
          <Button size="icon" variant="ghost" onClick={handleCopy} title="Copy root hash">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="default">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
