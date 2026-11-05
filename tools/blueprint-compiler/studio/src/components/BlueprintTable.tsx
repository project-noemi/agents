import { useState } from 'react'
import type { SavedBlueprintSummary } from '../api'

type Props = {
  items: SavedBlueprintSummary[]
  selectedId?: string
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export function BlueprintTable({ items, selectedId, onOpen, onRename, onDelete }: Props) {
  // The row being renamed, with the text typed so far.
  const [editing, setEditing] = useState<{ id: string; name: string }>()

  if (items.length === 0) return <p>No saved blueprints yet.</p>

  const commit = () => {
    const name = editing?.name.trim()
    if (editing && name) onRename(editing.id, name)
    setEditing(undefined)
  }

  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b">
          <th className="p-1">Name</th>
          <th className="p-1">Last saved</th>
          <th className="p-1">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((b) => {
          // `draft` is set only for the row being renamed, which keeps the types simple.
          const draft = editing?.id === b.id ? editing : undefined
          const renaming = draft !== undefined
          return (
            <tr key={b.id} className={b.id === selectedId ? 'border-b font-semibold' : 'border-b'}>
              <td className="p-1">
                {draft ? (
                  <input
                    aria-label="New name"
                    className="block w-full border p-1 font-normal"
                    maxLength={100}
                    autoFocus
                    value={draft.name}
                    onChange={(e) => setEditing({ id: b.id, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commit()
                      if (e.key === 'Escape') setEditing(undefined)
                    }}
                  />
                ) : (
                  b.name
                )}
              </td>
              <td className="p-1">{new Date(b.updatedAt).toLocaleString()}</td>
              <td className="space-x-2 p-1 text-right">
                {renaming ? (
                  <>
                    <button type="button" className="underline" onClick={commit}>
                      Save name
                    </button>
                    <button type="button" className="underline" onClick={() => setEditing(undefined)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="underline" onClick={() => onOpen(b.id)}>
                      Open
                    </button>
                    <button type="button" className="underline" onClick={() => setEditing({ id: b.id, name: b.name })}>
                      Rename
                    </button>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        if (window.confirm(`Delete "${b.name}"?`)) onDelete(b.id)
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}