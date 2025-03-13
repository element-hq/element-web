/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { forwardRef } from "react";

import { RovingTabIndexProvider } from "./RovingTabIndex";
import { getKeyBindingsManager } from "../KeyBindingsManager";
import { KeyBindingAction } from "./KeyboardShortcuts";

interface IProps extends Omit<React.HTMLProps<HTMLDivElement>, "onKeyDown"> {}

// This component implements the Toolbar design pattern from the WAI-ARIA Authoring Practices guidelines.
// https://www.w3.org/TR/wai-aria-practices-1.1/#toolbar
// All buttons passed in children must use RovingTabIndex to set `onFocus`, `isActive`, `ref`
const Toolbar = forwardRef<HTMLDivElement, IProps>(({ children, ...props }, ref) => {
    const onKeyDown = (ev: React.KeyboardEvent): void => {
        const target = ev.target as HTMLElement;
        // Don't interfere with input default keydown behaviour
        if (target.tagName === "INPUT") return;

        let handled = true;

        // HOME and END are handled by RovingTabIndexProvider
        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (action) {
            case KeyBindingAction.ArrowUp:
            case KeyBindingAction.ArrowDown:
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
        <RovingTabIndexProvider handleHomeEnd handleLeftRight handleUpDown onKeyDown={onKeyDown}>
            {({ onKeyDownHandler }) => (
                <div {...props} onKeyDown={onKeyDownHandler} role="toolbar" ref={ref}>
                    {children}
                </div>
            )}
        </RovingTabIndexProvider>
    );
});

export default Toolbar;
