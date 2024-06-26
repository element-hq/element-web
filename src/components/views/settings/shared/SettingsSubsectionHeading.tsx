/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { HTMLAttributes } from "react";

import Heading from "../../typography/Heading";

export interface SettingsSubsectionHeadingProps extends HTMLAttributes<HTMLDivElement> {
    heading: string;
    legacy?: boolean;
    children?: React.ReactNode;
}

export const SettingsSubsectionHeading: React.FC<SettingsSubsectionHeadingProps> = ({
    heading,
    legacy = true,
    children,
    ...rest
}) => {
    const size = legacy ? "4" : "3";

    return (
        <div {...rest} className="mx_SettingsSubsectionHeading">
            <Heading className="mx_SettingsSubsectionHeading_heading" size={size} as="h3">
                {heading}
            </Heading>
            {children}
        </div>
    );
};
