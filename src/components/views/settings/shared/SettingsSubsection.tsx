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

export interface SettingsSubsectionProps extends HTMLAttributes<HTMLDivElement> {
    heading: string;
    description?: string | React.ReactNode;
    children?: React.ReactNode;
}

const SettingsSubsection: React.FC<SettingsSubsectionProps> = ({ heading, description, children, ...rest }) => (
    <div {...rest} className="mx_SettingsSubsection">
        <Heading className="mx_SettingsSubsection_heading" size='h3'>{ heading }</Heading>
        { !!description && <div className="mx_SettingsSubsection_description">{ description }</div> }
        <div className="mx_SettingsSubsection_content">
            { children }
        </div>
    </div>
);

export default SettingsSubsection;
