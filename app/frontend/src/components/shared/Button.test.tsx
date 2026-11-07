import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as Dialog from '@radix-ui/react-dialog'
import { Button, type ButtonVariant } from './Button'

describe('Button', () => {
  it.each<ButtonVariant>(['primary', 'secondary', 'danger', 'ghost', 'icon'])('renders %s styling', variant => {
    render(<Button variant={variant}>Action</Button>)
    expect(screen.getByRole('button')).toHaveClass(
      variant === 'ghost' || variant === 'icon' ? `button-plain--${variant}` : `action-button--${variant}`,
    )
  })

  it('defaults to a non-submitting secondary button and forwards native props and refs', () => {
    const ref = createRef<HTMLButtonElement>()
    const click = vi.fn()
    render(<Button ref={ref} className="custom" title="Tooltip" aria-label="Run" data-testid="run" onClick={click}>Action</Button>)
    const button = screen.getByRole('button', { name: 'Run' })
    expect(ref.current).toBe(button)
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('title', 'Tooltip')
    expect(button).toHaveClass('action-button', 'action-button--secondary', 'custom')
    fireEvent.click(button)
    expect(click).toHaveBeenCalledOnce()
  })

  it('supports explicit submit behavior and disabled native behavior', () => {
    const click = vi.fn()
    render(<Button type="submit" disabled onClick={click}>Save</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(click).not.toHaveBeenCalled()
  })

  it('accepts callback refs and Radix asChild injected handlers and attributes', () => {
    const ref = vi.fn()
    render(<Dialog.Root><Dialog.Trigger asChild><Button ref={ref}>Open</Button></Dialog.Trigger></Dialog.Root>)
    const button = screen.getByRole('button')
    expect(ref).toHaveBeenCalledWith(button)
    expect(button).toHaveAttribute('data-state', 'closed')
    fireEvent.click(button)
    expect(button).toHaveAttribute('data-state', 'open')
  })
})
