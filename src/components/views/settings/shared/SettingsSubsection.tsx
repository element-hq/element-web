/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { type HTMLAttributes } from "react";
import { Separator } from "@vector-im/compound-web";

import { SettingsSubsectionHeading } from "./SettingsSubsectionHeading";

export interface SettingsSubsectionProps extends HTMLAttributes<HTMLDivElement> {
    heading?: string | React.ReactNode;
    description?: string | React.ReactNode;
    children?: React.ReactNode;
    // when true content will be justify-items: stretch, which will make items within the section stretch to full width.
    stretchContent?: boolean;
    /*
     * When true, the legacy UI style will be applied to the subsection.
     * @default true
     */
    legacy?: boolean;
}

export const SettingsSubsectionText: React.FC<HTMLAttributes<HTMLDivElement>> = ({ children, ...rest }) => (
    <div {...rest} className="mx_SettingsSubsection_text">
        {children}
    </div>
);

export const SettingsSubsection: React.FC<SettingsSubsectionProps> = ({
    heading,
    description,
    children,
    stretchContent,
    legacy = true,
    ...rest
}) => (
    <div
        {...rest}
        className={classNames("mx_SettingsSubsection", {
            mx_SettingsSubsection_newUi: !legacy,
        })}
    >
        {typeof heading === "string" ? <SettingsSubsectionHeading heading={heading} /> : <>{heading}</>}
        {!!description && (
            <div className="mx_SettingsSubsection_description">
                <SettingsSubsectionText>{description}</SettingsSubsectionText>
            </div>
        )}
        {!!children && (
            <div
                className={classNames("mx_SettingsSubsection_content", {
                    mx_SettingsSubsection_contentStretch: !!stretchContent,
                    mx_SettingsSubsection_noHeading: !heading && !description,
                    mx_SettingsSubsection_content_newUi: !legacy,
                })}
            >
                {children}
            </div>
        )}
        {!legacy && <Separator />}
    </div>
);
