/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type Ref } from "react";

import { RovingAction, RovingTabIndexProvider, type RovingTabIndexProviderProps } from "./RovingTabIndex";

/**
 * Props for {@link Toolbar}.
 */
export interface ToolbarProps extends Omit<React.HTMLProps<HTMLDivElement>, "onKeyDown"> {
    ref?: Ref<HTMLDivElement>;
    /**
     * Optional action resolver used to map keyboard events to
     * {@link RovingAction} values, e.g. to apply app-level custom keybindings.
     *
     * When omitted, a default mapping based on `KeyboardEvent.key` is used.
     */
    getAction?: RovingTabIndexProviderProps["getAction"];
}

const getDefaultAction = (ev: React.KeyboardEvent): RovingAction | undefined => {
    switch (ev.key) {
        case "ArrowUp":
            return RovingAction.ArrowUp;
        case "ArrowDown":
            return RovingAction.ArrowDown;
        default:
            return undefined;
    }
};

/**
 * This component implements the Toolbar design pattern from the WAI-ARIA Authoring Practices guidelines.
 * https://www.w3.org/TR/wai-aria-practices-1.1/#toolbar
 * All buttons passed in children must use RovingTabIndex to set `onFocus`, `isActive`, `ref`.
 */
export const Toolbar = ({ children, ref, getAction, ...props }: ToolbarProps): JSX.Element => {
    const onKeyDown = (ev: React.KeyboardEvent): void => {
        const target = ev.target as HTMLElement;
        // Don't interfere with input default keydown behaviour
        if (target.tagName === "INPUT") return;

        let handled = true;

        // HOME and END are handled by RovingTabIndexProvider
        const action = getAction?.(ev) ?? getDefaultAction(ev);
        switch (action) {
            case RovingAction.ArrowUp:
            case RovingAction.ArrowDown:
                if (target.hasAttribute("aria-haspopup")) {
                    target.click();
                }
                break;

            default:
                handled = false;
        }

        if (handled) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    };

    // We handle both up/down and left/right as is allowed in the above WAI ARIA best practices
    return (
        <RovingTabIndexProvider handleHomeEnd handleLeftRight handleUpDown onKeyDown={onKeyDown} getAction={getAction}>
            {({ onKeyDownHandler }) => (
                // This may be wrong but seems to work, this is a roving-toolbar, so the focus follows one of the children
                // oxlint-disable-next-line jsx-a11y/interactive-supports-focus
                <div {...props} onKeyDown={onKeyDownHandler} role="toolbar" ref={ref}>
                    {children}
                </div>
            )}
        </RovingTabIndexProvider>
    );
};
