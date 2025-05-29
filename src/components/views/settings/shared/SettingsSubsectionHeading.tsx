/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type HTMLAttributes } from "react";

import Heading from "../../typography/Heading";

export interface SettingsSubsectionHeadingProps extends HTMLAttributes<HTMLDivElement> {
    heading: string;
    children?: React.ReactNode;
}

export const SettingsSubsectionHeading: React.FC<SettingsSubsectionHeadingProps> = ({ heading, children, ...rest }) => {
    return (
        <div {...rest} className="mx_SettingsSubsectionHeading">
            <Heading className="mx_SettingsSubsectionHeading_heading" size="4" as="h3">
                {heading}
            </Heading>
            {children}
        </div>
    );
};
