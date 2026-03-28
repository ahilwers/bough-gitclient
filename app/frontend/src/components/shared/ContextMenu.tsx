import * as ContextMenuPrimitive from '@radix-ui/react-context-menu'

export interface ContextMenuItem {
  label?: string
  onClick?: () => void
  destructive?: boolean
  type?: 'separator'
  shortcut?: string
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  children: React.ReactNode
}

export function ContextMenu({ items, children }: ContextMenuProps) {
  return (
    <ContextMenuPrimitive.Root>
      <ContextMenuPrimitive.Trigger asChild>
        {children}
      </ContextMenuPrimitive.Trigger>

      <ContextMenuPrimitive.Portal>
        <ContextMenuPrimitive.Content
          style={{
            minWidth: 180,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '4px 0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 100,
          }}
        >
          {items.map((item, idx) => {
            if (item.type === 'separator') {
              return (
                <ContextMenuPrimitive.Separator
                  key={idx}
                  style={{
                    height: 1,
                    background: 'var(--border-sub)',
                    margin: '4px 0',
                  }}
                />
              )
            }

            return (
              <ContextMenuPrimitive.Item
                key={idx}
                onSelect={item.onClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '5px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: item.destructive ? 'var(--danger)' : 'var(--text-pri)',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget as HTMLElement
                  target.style.background = item.destructive
                    ? 'color-mix(in srgb, var(--danger) 12%, transparent)'
                    : 'var(--bg-content)'
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget as HTMLElement
                  target.style.background = 'transparent'
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span style={{ fontSize: 11, color: 'var(--text-ter)', fontFamily: 'monospace' }}>
                    {item.shortcut}
                  </span>
                )}
              </ContextMenuPrimitive.Item>
            )
          })}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  )
}
