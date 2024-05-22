/*
Copyright 2022-2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import classnames from "classnames";
import React, { HTMLAttributes } from "react";

import Heading from "../../typography/Heading";

export interface SettingsSectionProps extends HTMLAttributes<HTMLDivElement> {
    heading?: string | React.ReactNode;
    children?: React.ReactNode;
}

function renderHeading(heading: string | React.ReactNode | undefined): React.ReactNode | undefined {
    switch (typeof heading) {
        case "string":
            return (
                <Heading as="h2" size="3">
                    {heading}
                </Heading>
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
export const SettingsSection: React.FC<SettingsSectionProps> = ({ className, heading, children, ...rest }) => (
    <div {...rest} className={classnames("mx_SettingsSection", className)}>
        {renderHeading(heading)}
        <div className="mx_SettingsSection_subSections">{children}</div>
    </div>
);
