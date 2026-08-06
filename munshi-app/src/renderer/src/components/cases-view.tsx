import { useEffect, useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2, FolderOpen, AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { CaseFormDialog } from '@/components/case-form-dialog'
import type { CaseItem } from '../../../shared/types'

export function CasesView(): JSX.Element {
  const [cases, setCases] = useState<CaseItem[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CaseItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CaseItem | null>(null)
  const [provisioningId, setProvisioningId] = useState<string | null>(null)

  useEffect(() => {
    void window.api.listCases().then(setCases)
  }, [])

  const tryAgain = async (c: CaseItem): Promise<void> => {
    if (provisioningId) return
    setProvisioningId(c.id)
    try {
      const r = await window.api.provisionCase(c.id)
      toast[r.ok ? 'success' : 'error'](r.message)
      setCases(await window.api.listCases())
    } catch {
      toast.error('Something went wrong while checking this case. Please try again.')
    } finally {
      setProvisioningId(null)
    }
  }

  const openAdd = (): void => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (c: CaseItem): void => {
    setEditing(c)
    setFormOpen(true)
  }

  const toggleEnabled = async (c: CaseItem): Promise<void> => {
    const updated = await window.api.saveCase({ ...c, enabled: !c.enabled })
    setCases(updated)
  }

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return
    const updated = await window.api.deleteCase(deleteTarget.id)
    setCases(updated)
    setDeleteTarget(null)
    toast.success('Case removed')
  }

  return (
    <div className="cases-view">
      <div className="cases-toolbar">
        <div>
          <h2 className="cases-heading">Your cases</h2>
          <p className="cases-subheading">
            {cases.length === 0
              ? 'No cases yet.'
              : `${cases.filter((c) => c.enabled).length} of ${cases.length} syncing`}
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="icon-leading" />
          Add case
        </Button>
      </div>

      {cases.length === 0 ? (
        <Card>
          <CardContent className="cases-empty">
            <div className="cases-empty-icon">
              <FolderOpen className="cases-empty-glyph" />
            </div>
            <div>
              <p className="cases-empty-title">Add your first case</p>
              <p className="cases-empty-text">
                Munshi will track its hearing dates and keep your calendar up to date.
              </p>
            </div>
            <Button onClick={openAdd}>
              <Plus className="icon-leading" />
              Add case
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="cases-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next hearing</TableHead>
                  <TableHead className="cases-actions-col" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="case-number">
                        {c.titleFromSite ?? c.caseNumber}
                      </div>
                      {c.titleFromSite ? (
                        <div className="case-name">{c.caseNumber}</div>
                      ) : null}
                      {c.needsAttention && (
                        <div className="case-warning">
                          <AlertTriangle className="icon-sm" aria-hidden="true" />
                          <span>No calendar event yet — this case is not protected.</span>
                          <Button
                            variant="link"
                            className="case-warning-action"
                            disabled={provisioningId !== null}
                            aria-label={`Try again for case ${c.caseNumber}`}
                            onClick={() => void tryAgain(c)}
                          >
                            {provisioningId === c.id ? (
                              <>
                                <Loader2 className="icon-leading-sm is-spinning" aria-hidden="true" />
                                Checking…
                              </>
                            ) : (
                              'Try again'
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{c.district}</TableCell>
                    <TableCell>
                      {c.enabled ? (
                        <Badge variant="secondary">Syncing</Badge>
                      ) : (
                        <Badge variant="outline">Paused</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.lastKnownHearing ? (
                        <span>{c.lastKnownHearing}</span>
                      ) : (
                        <span className="case-hearing-empty">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="icon" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Pencil className="icon-leading" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleEnabled(c)}>
                            {c.enabled ? 'Pause syncing' : 'Resume syncing'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="case-remove-item"
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 className="icon-leading" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CaseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSaved={setCases}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this case?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.caseNumber} will no longer be tracked. This does not delete anything
              already on your Google Calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
