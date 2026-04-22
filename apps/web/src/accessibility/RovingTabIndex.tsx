/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    checkInputableElement,
    findSiblingElement,
    RovingAction,
    RovingStateActionType,
    RovingTabIndexContext,
    RovingTabIndexProvider as SharedRovingTabIndexProvider,
    useRovingTabIndex,
    type IAction,
    type IState,
    type RovingTabIndexProviderProps,
} from "@element-hq/web-shared-components";

import { getKeyBindingsManager } from "../KeyBindingsManager";
import { KeyBindingAction } from "./KeyboardShortcuts";

export { checkInputableElement, findSiblingElement, RovingStateActionType, RovingTabIndexContext, useRovingTabIndex };
export type { IAction, IState };

/**
 * Module to simplify implementing the Roving TabIndex accessibility technique
 *
 * Wrap the Widget in an RovingTabIndexContextProvider
 * and then for all buttons make use of useRovingTabIndex or RovingTabIndexWrapper.
 * The code will keep track of which tabIndex was most recently focused and expose that information as `isActive` which
 * can then be used to only set the tabIndex to 0 as expected by the roving tabindex technique.
 * When the active button gets unmounted the closest button will be chosen as expected.
 * Initially the first button to mount will be given active state.
 *
 * https://developer.mozilla.org/en-US/docs/Web/Accessibility/Keyboard-navigable_JavaScript_widgets#Technique_1_Roving_tabindex
 */

const getWebRovingAction = (ev: React.KeyboardEvent): RovingAction | undefined => {
    switch (getKeyBindingsManager().getAccessibilityAction(ev)) {
        case KeyBindingAction.Home:
            return RovingAction.Home;
        case KeyBindingAction.End:
            return RovingAction.End;
        case KeyBindingAction.ArrowLeft:
            return RovingAction.ArrowLeft;
        case KeyBindingAction.ArrowUp:
            return RovingAction.ArrowUp;
        case KeyBindingAction.ArrowRight:
            return RovingAction.ArrowRight;
        case KeyBindingAction.ArrowDown:
            return RovingAction.ArrowDown;
        case KeyBindingAction.Tab:
            return RovingAction.Tab;
        default:
            return undefined;
    }
};

type IProps = Omit<RovingTabIndexProviderProps, "getAction">;

export const RovingTabIndexProvider: React.FC<IProps> = (props) => {
    return <SharedRovingTabIndexProvider {...props} getAction={getWebRovingAction} />;
};

// re-export the semantic helper components for simplicity
export { RovingTabIndexWrapper } from "./roving/RovingTabIndexWrapper";
export { RovingAccessibleButton } from "./roving/RovingAccessibleButton";
