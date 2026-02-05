/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type KeyboardEventHandler, type MouseEventHandler } from "react";
import classNames from "classnames";

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
     * The CSS class name.
     */
    className?: string;
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
    const { displayName, colorClass, displayIdentifier, title, emphasizeDisplayName, className } = useViewModel(vm);

    const displayNameClasses = classNames(colorClass, {
        [styles.disambiguatedProfile_displayName]: emphasizeDisplayName,
        mx_DisambiguatedProfile_displayName: emphasizeDisplayName,
    });

    // Handle keyboard interaction for accessibility if onClick is provided
    const handleKeyDown: KeyboardEventHandler<HTMLDivElement> | undefined = vm.onClick
        ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  vm.onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
              }
          }
        : undefined;

    return (
        <div
            className={classNames(className, styles.disambiguatedProfile)}
            title={title}
            onClick={vm.onClick}
            onKeyDown={handleKeyDown}
            role={vm.onClick ? "button" : undefined}
            tabIndex={vm.onClick ? 0 : undefined}
        >
            <span className={displayNameClasses} dir="auto">
                {displayName}
            </span>
            {displayIdentifier && (
                <span className={classNames("mx_DisambiguatedProfile_mxid", styles.disambiguatedProfile_mxid)}>
                    {displayIdentifier}
                </span>
            )}
        </div>
    );
}
