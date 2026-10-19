import type { SavedBlueprintSummary } from '../api'

type Props = {
  items: SavedBlueprintSummary[]
  selectedId?: string
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

export function BlueprintTable({ items, selectedId, onOpen, onDelete }: Props) {
  if (items.length === 0) return <p>No saved blueprints yet.</p>

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
        {items.map((b) => (
          <tr key={b.id} className={b.id === selectedId ? 'border-b font-semibold' : 'border-b'}>
            <td className="p-1">{b.name}</td>
            <td className="p-1">{new Date(b.updatedAt).toLocaleString()}</td>
            <td className="space-x-2 p-1 text-right">
              <button type="button" className="underline" onClick={() => onOpen(b.id)}>
                Open
              </button>
              <button type="button" className="underline" onClick={() => onDelete(b.id)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
