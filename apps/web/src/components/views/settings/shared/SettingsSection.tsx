/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classnames from "classnames";
import React, { type ComponentProps, createContext, type HTMLAttributes, useContext } from "react";

import Heading from "../../typography/Heading";
import { SettingsHeader } from "../SettingsHeader";

export interface SettingsSectionProps extends HTMLAttributes<HTMLDivElement> {
    heading?: string | React.ReactNode;
    subHeading?: string | React.ReactNode;
    children?: React.ReactNode;
    legacy?: boolean;
}

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

/**
 * React context to correctly set heading levels in nested settings sections dynamically
 */
export const HeadingLevelContext = createContext<HeadingLevel>(2);

function SectionHeading({
    heading,
    legacy,
    level,
}: {
    heading: string | React.ReactNode | undefined;
    legacy: boolean;
    level: HeadingLevel;
}): React.ReactNode | undefined {
    switch (typeof heading) {
        case "string":
            return legacy ? (
                <Heading as={`h${level}`} size={(level + 1).toString() as ComponentProps<typeof Heading>["size"]}>
                    {heading}
                </Heading>
            ) : (
                <SettingsHeader as={`h${level}`} label={heading} />
            );
        case "undefined":
            return undefined;
        default:
            return heading;
    }
}

/**
 * A section of settings content
 * A SettingsTab may contain one or more SettingsSections
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
export const SettingsSection: React.FC<SettingsSectionProps> = ({
    className,
    heading,
    subHeading,
    legacy = true,
    children,
    ...rest
}) => {
    const level = useContext(HeadingLevelContext);

    return (
        <div
            {...rest}
            className={classnames("mx_SettingsSection", className, {
                mx_SettingsSection_newUi: !legacy,
            })}
        >
            {heading &&
                (subHeading ? (
                    <div className="mx_SettingsSection_header">
                        <SectionHeading heading={heading} legacy={legacy} level={level} />
                        {subHeading}
                    </div>
                ) : (
                    <SectionHeading heading={heading} legacy={legacy} level={level} />
                ))}
            <HeadingLevelContext.Provider value={heading ? ((level + 1) as HeadingLevel) : level}>
                {legacy ? <div className="mx_SettingsSection_subSections">{children}</div> : children}
            </HeadingLevelContext.Provider>
        </div>
    );
};
