/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import { useRovingTabIndex } from "../roving";

/**
 * An event which can trigger a button activation.
 */
export type ButtonEvent = React.MouseEvent<Element> | React.KeyboardEvent<Element> | React.FormEvent<Element>;

interface RovingButtonProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick"> {
    /**
     * Event handler for button activation. Invoked on click, Enter keydown and Space keyup.
     */
    onClick(ev: ButtonEvent): void;
    /**
     * Whether the button should be disabled. A disabled button keeps its role and
     * remains discoverable by keyboard, but is marked `aria-disabled` and does not
     * invoke `onClick`.
     */
    disabled?: boolean;
    /**
     * Whether the button should take the active roving tab stop when the mouse
     * moves over it.
     */
    focusOnMouseOver?: boolean;
}

/**
 * A minimal button participating in the surrounding roving tabindex group.
 *
 * Rendered as a `div` with `role="button"` (overridable) rather than a native
 * button so that keyboard activation events are observable by the caller:
 * Enter is consumed on keydown and Space on keyup, mirroring native button
 * behaviour, without also risking activation of other focusable elements that
 * might receive focus as a result of the click handler running.
 */
export function RovingButton({
    onClick,
    disabled,
    focusOnMouseOver,
    onFocus,
    onMouseOver,
    onKeyDown,
    onKeyUp,
    role = "button",
    children,
    ...props
}: RovingButtonProps): JSX.Element {
    const [onFocusInternal, isActive, ref] = useRovingTabIndex<HTMLDivElement>();

    let behaviourProps: React.HTMLAttributes<HTMLDivElement> = { onKeyDown, onKeyUp };
    if (disabled) {
        behaviourProps["aria-disabled"] = true;
    } else {
        behaviourProps = {
            onClick,
            onKeyDown: (e) => {
                switch (e.key) {
                    case "Enter":
                        e.stopPropagation();
                        e.preventDefault();
                        onClick(e);
                        break;
                    case " ":
                        e.stopPropagation();
                        e.preventDefault();
                        break;
                    default:
                        onKeyDown?.(e);
                }
            },
            onKeyUp: (e) => {
                switch (e.key) {
                    case "Enter":
                        e.stopPropagation();
                        e.preventDefault();
                        break;
                    case " ":
                        e.stopPropagation();
                        e.preventDefault();
                        onClick(e);
                        break;
                    default:
                        onKeyUp?.(e);
                }
            },
        };
    }

    return (
        <div
            {...props}
            {...behaviourProps}
            role={role}
            ref={ref}
            tabIndex={isActive ? 0 : -1}
            onFocus={(event) => {
                onFocusInternal();
                onFocus?.(event);
            }}
            onMouseOver={(event) => {
                if (focusOnMouseOver) onFocusInternal();
                onMouseOver?.(event);
            }}
        >
            {children}
        </div>
    );
}
