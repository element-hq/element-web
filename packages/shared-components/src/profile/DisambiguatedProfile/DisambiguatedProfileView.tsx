/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler } from "react";
import classNames from "classnames";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";
import styles from "./DisambiguatedProfile.module.css";


interface MemberInfo {
    userId: string;
    roomId: string;
    rawDisplayName?: string;
    disambiguate: boolean;
}

/**
 * The snapshot representing the current state of the DisambiguatedProfile.
 */
export interface DisambiguatedProfileViewSnapshot {

    /**
     * Optional member information for disambiguation.
     */
    member?: MemberInfo | null;
    /**
     * The display name to show.
     */
    displayName: string;
    /**
     * Optional color class for username coloring.
     */
    colorClass?: string;
    /**
     * Whether to emphasize the display name styling.
     */
    emphasizeDisplayName?: boolean;
    /**
     * Optional MXID identifier to show for disambiguation.
     * Only shown when disambiguation is needed.
     */
    mxid?: string;
    /**
     * Optional tooltip title text.
     */
    title?: string;
}


/**
 * Actions that can be performed on the DisambiguatedProfile.
 */
export interface DisambiguatedProfileViewActions {
    /**
     * Optional click handler for the profile.
     */
    onClick?: MouseEventHandler<HTMLDivElement>;
}

/**
 * The view model for DisambiguatedProfileView.
 */
export type DisambiguatedProfileViewModel = ViewModel<DisambiguatedProfileViewSnapshot> &
    DisambiguatedProfileViewActions;

interface DisambiguatedProfileViewProps {
    /**
     * The view model for the disambiguated profile.
     */
    vm: DisambiguatedProfileViewModel;
}

/**
 * A component to display a user's profile with optional disambiguation.
 * Shows the display name and optionally the MXID when disambiguation is needed
 * (e.g., when multiple users have the same display name).
 *
 * @example
 * ```tsx
 * <DisambiguatedProfileView vm={disambiguatedProfileViewModel} />
 * ```
 */
export function DisambiguatedProfileView({ vm }: Readonly<DisambiguatedProfileViewProps>): JSX.Element {
    const { displayName, colorClass, emphasizeDisplayName, mxid, title } = useViewModel(vm);

    const displayNameClasses = classNames(styles.displayName, colorClass, {
        [styles.emphasize]: emphasizeDisplayName,
    });

    return (
        <div
            className={styles.disambiguatedProfile}
            title={title}
            onClick={vm.onClick}
            data-testid="disambiguated-profile"
        >
            <span className={displayNameClasses} dir="auto">
                {displayName}
            </span>
            {mxid && (
                <span className={styles.mxid} data-testid="disambiguated-profile-mxid">
                    {mxid}
                </span>
            )}
        </div>
    );
}
