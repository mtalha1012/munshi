import { CircleUser, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { AuthState } from '../../../shared/types'

export function AccountMenu({
  auth,
  onSignedOut
}: {
  auth: AuthState
  onSignedOut: (a: AuthState) => void
}): JSX.Element {
  const signOut = async (): Promise<void> => {
    const state = await window.api.signOut()
    onSignedOut(state)
    toast.success('Signed out')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <CircleUser className="account-glyph" />
          <span className="sr-only">Account</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="account-menu">
        <DropdownMenuLabel className="account-email">{auth.email || 'Signed in'}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="icon-leading" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
