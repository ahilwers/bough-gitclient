import type { ComponentPropsWithRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon'
export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
}

/** Native button with shared interaction states. React 19 forwards ref as a prop,
 * including refs and event handlers injected by Radix's asChild triggers. */
export function Button({ variant = 'secondary', type = 'button', className, ref, ...props }: ButtonProps) {
  const classes = variant === 'ghost' || variant === 'icon'
    ? `button-plain button-plain--${variant}`
    : `action-button action-button--${variant}`
  return <button ref={ref} type={type} className={`${classes}${className ? ` ${className}` : ''}`} {...props} />
}
