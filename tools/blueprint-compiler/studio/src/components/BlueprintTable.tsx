import { useState } from 'react'
import type { SavedBlueprintSummary } from '../api'
import { Icon } from './Icon'

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
    <table className="table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Last saved</th>
          <th>
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
            <tr key={b.id} className={b.id === selectedId ? 'font-medium' : undefined}>
              <td>
                {draft ? (
                  <input
                    aria-label="New name"
                    className="field mb-0 font-normal"
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
              <td>{new Date(b.updatedAt).toLocaleString()}</td>
              <td className="text-right">
                {renaming ? (
                  <>
                    <button type="button" className="btn btn-sm" onClick={commit}>
                      <Icon name="check" />
                      Save name
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setEditing(undefined)}>
                      <Icon name="close" />
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-sm" onClick={() => onOpen(b.id)}>
                      <Icon name="open" />
                      Open
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setEditing({ id: b.id, name: b.name })}>
                      <Icon name="edit" />
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        if (window.confirm(`Delete "${b.name}"?`)) onDelete(b.id)
                      }}
                    >
                      <Icon name="delete" />
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
