/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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

    return (
        <RovingTabIndexProvider handleHomeEnd handleLeftRight onKeyDown={onKeyDown}>
            {({ onKeyDownHandler }) => (
                <div {...props} onKeyDown={onKeyDownHandler} role="toolbar" ref={ref}>
                    {children}
                </div>
            )}
        </RovingTabIndexProvider>
    );
});

export default Toolbar;
