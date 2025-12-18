/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";

import { useViewModel } from "../../useViewModel";
import { _t } from "../../utils/i18n";
import { type ViewModel } from "../../viewmodel";

export interface RoomStatusBarViewActions {
    /**
     * Called when the user clicks on the 'resend all' button in the 'unsent messages' bar.
     */
    onResendAllClick?: () => void;

    /**
     * Called when the user clicks on the 'cancel all' button in the 'unsent messages' bar.
     */
    onCancelAllClick?: () => void;
}

export interface RoomStatusBarNoConnection {
    connectionLost: boolean;
}

export interface RoomStatusBarConsentState {
    consentUri: string;
}

export interface RoomStatusBarResourceLimitedState {
    consentUri: string;
}

export interface RoomStatusBarUnsentMessagesState {
    consentUri: string;
}

export interface RoomStatusBarViewSnapshot {
    /**
     * Whether the banner is currently visible.
     */
    visible: boolean;
    state: RoomStatusBarNoConnection|RoomStatusBarConsentState|RoomStatusBarResourceLimitedState|RoomStatusBarUnsentMessagesState|null;
}

/**
 * The view model for the banner.
 */
export type RoomStatusBarViewModel = ViewModel<RoomStatusBarViewSnapshot> &
    RoomStatusBarViewActions;

interface RoomStatusBarViewProps {
    /**
     * The view model for the banner.
     */
    vm: RoomStatusBarViewModel;
}

/**
 * A component to alert that history is shared to new members of the room.
 *
 * @example
 * ```tsx
 * <RoomStatusBarView vm={RoomStatusBarViewModel} />
 * ```
 */
export function RoomStatusBarView({ vm }: Readonly<RoomStatusBarViewProps>): JSX.Element {
    const { visible } = useViewModel(vm);
    
    return (
        <p> Tada! </p>
    );
}
