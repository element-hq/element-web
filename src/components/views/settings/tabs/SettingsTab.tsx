/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/
import React, { HTMLAttributes } from "react";

export interface SettingsTabProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
    children?: React.ReactNode;
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
const SettingsTab: React.FC<SettingsTabProps> = ({ children, ...rest }) => (
    <div {...rest} className="mx_SettingsTab">
        <div className="mx_SettingsTab_sections">{children}</div>
    </div>
);

export default SettingsTab;
