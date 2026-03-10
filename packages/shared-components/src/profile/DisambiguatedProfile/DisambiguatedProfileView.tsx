/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler } from "react";
import classNames from "classnames";
import { Button } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./DisambiguatedProfile.module.css";

/**
 * The snapshot representing the current state of the DisambiguatedProfile.
 */
export interface DisambiguatedProfileViewSnapshot {
    /**
     * The display name to show.
     */
    displayName: string;
    /**
     * The CSS class for coloring the display name (e.g., "mx_Username_color1").
     * Undefined if coloring is not enabled.
     */
    colorClass?: string;
    /**
     * The formatted user identifier to display when disambiguation is needed.
     * Undefined if disambiguation is not required.
     */
    displayIdentifier?: string;
    /**
     * The tooltip title text (pre-translated).
     * Undefined if tooltip is not enabled.
     */
    title?: string;
    /**
     * Whether to emphasize the display name with additional styling.
     */
    emphasizeDisplayName?: boolean;
}

/**
 * Actions that can be performed on the DisambiguatedProfile.
 */
export interface DisambiguatedProfileViewActions {
    /**
     * Optional click handler for the profile.
     */
    onClick?: MouseEventHandler<HTMLAnchorElement>;
}

/**
 * The view model for DisambiguatedProfileView.
 */
export type DisambiguatedProfileViewModel = ViewModel<
    DisambiguatedProfileViewSnapshot,
    DisambiguatedProfileViewActions
>;

interface DisambiguatedProfileViewProps {
    /**
     * The view model for the disambiguated profile.
     */
    vm: DisambiguatedProfileViewModel;
    /**
     * Optional CSS class name applied to the profile container.
     */
    className?: string;
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
export function DisambiguatedProfileView({ vm, className }: Readonly<DisambiguatedProfileViewProps>): JSX.Element {
    const { displayName, colorClass, displayIdentifier, title, emphasizeDisplayName } = useViewModel(vm);

    const displayNameClasses = classNames(colorClass, emphasizeDisplayName && styles.disambiguatedProfile_displayName);

    if (vm.onClick) {
        return (
            <Button
                as="a"
                className={classNames(className, styles.disambiguatedProfile)}
                title={title}
                onClick={vm.onClick}
            >
                <span
                    className={displayNameClasses}
                    data-part="display-name"
                    data-emphasized={emphasizeDisplayName ? "true" : undefined}
                    dir="auto"
                >
                    {displayName}
                </span>
                {/* data-part hooks are used by app CSS selectors such as .mx_MemberTileView .mx_DisambiguatedProfile > [data-part="mxid"] */}
                {displayIdentifier && (
                    <span className={styles.disambiguatedProfile_mxid} data-part="mxid">
                        {displayIdentifier}
                    </span>
                )}
            </Button>
        );
    }

    return (
        <div className={classNames(className, styles.disambiguatedProfile)} title={title}>
            <span
                className={displayNameClasses}
                data-part="display-name"
                data-emphasized={emphasizeDisplayName ? "true" : undefined}
                dir="auto"
            >
                {displayName}
            </span>
            {/* data-part hooks are used by app CSS selectors such as .mx_MemberTileView .mx_DisambiguatedProfile > [data-part="mxid"] */}
            {displayIdentifier && (
                <span className={styles.disambiguatedProfile_mxid} data-part="mxid">
                    {displayIdentifier}
                </span>
            )}
        </div>
    );
}
