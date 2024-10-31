/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { useRovingTabIndex } from "../RovingTabIndex";
import StyledCheckbox from "../../components/views/elements/StyledCheckbox";
import { KeyBindingAction } from "../KeyboardShortcuts";
import { getKeyBindingsManager } from "../../KeyBindingsManager";

interface IProps extends React.ComponentProps<typeof StyledCheckbox> {
    label?: string;
    onChange(): void; // we handle keyup/down ourselves so lose the ChangeEvent
    onClose(): void; // gets called after onChange on KeyBindingAction.ActivateSelectedButton
}

// Semantic component for representing a styled role=menuitemcheckbox
export const StyledMenuItemCheckbox: React.FC<IProps> = ({ children, label, onChange, onClose, ...props }) => {
    const [onFocus, isActive, ref] = useRovingTabIndex<HTMLInputElement>();

    const onKeyDown = (e: React.KeyboardEvent): void => {
        let handled = true;
        const action = getKeyBindingsManager().getAccessibilityAction(e);

        switch (action) {
            case KeyBindingAction.Space:
                onChange();
                break;
            case KeyBindingAction.Enter:
                onChange();
                // Implements https://www.w3.org/TR/wai-aria-practices/#keyboard-interaction-12
                onClose();
                break;
            default:
                handled = false;
        }

        if (handled) {
            e.stopPropagation();
            e.preventDefault();
        }
    };
    const onKeyUp = (e: React.KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(e);
        switch (action) {
            case KeyBindingAction.Space:
            case KeyBindingAction.Enter:
                // prevent the input default handler as we handle it on keydown to match
                // https://www.w3.org/TR/wai-aria-practices/examples/menubar/menubar-2/menubar-2.html
                e.stopPropagation();
                e.preventDefault();
                break;
        }
    };
    return (
        <StyledCheckbox
            {...props}
            role="menuitemcheckbox"
            aria-label={label}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onFocus={onFocus}
            inputRef={ref}
            tabIndex={isActive ? 0 : -1}
        >
            {children}
        </StyledCheckbox>
    );
};
