/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React, { type HTMLAttributes } from "react";
import classNames from "classnames";

export interface SettingsTabProps extends HTMLAttributes<HTMLDivElement> {
    children?: React.ReactNode;
    /**
     * Added to the classList of the root element
     */
    className?: string;
}

/**
 * Container for a tab of settings panel content
 * Should contain one or more SettingsSection
 * Settings width, padding and spacing between sections
 * Eg:
 * ```
 * <SettingsTab>
 *      <SettingsSection heading="General">
 *           <SettingsSubsection heading="Profile">
 *              // profile settings form
 *          <SettingsSubsection>
 *          <SettingsSubsection heading="Account">
 *              // account settings
 *          <SettingsSubsection>
 *      </SettingsSection>
 * </SettingsTab>
 * ```
 */
const SettingsTab: React.FC<SettingsTabProps> = ({ children, className, ...rest }) => (
    <div {...rest} className={classNames("mx_SettingsTab", className)}>
        <div className="mx_SettingsTab_sections">{children}</div>
    </div>
);

export default SettingsTab;
