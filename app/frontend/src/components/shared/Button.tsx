// Copyright (C) 2026 Achim Hilwers
//
// This file is part of GitMorrow.
//
// GitMorrow is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

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
