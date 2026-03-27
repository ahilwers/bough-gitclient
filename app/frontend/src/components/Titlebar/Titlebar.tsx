export default function Titlebar() {
  return (
    <div
      style={{
        height: 40,
        background: 'var(--bg-titlebar)',
        borderBottom: '1px solid var(--border-sub)',
        // Allow window dragging on the titlebar
        // @ts-expect-error webkit drag region
        WebkitAppRegion: 'drag',
        flexShrink: 0,
      }}
    />
  )
}
