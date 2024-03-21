/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode, HTMLAttributes } from "react";
import classNames from "classnames";

import { SettingsSubsectionText } from "./shared/SettingsSubsection";

interface Props extends HTMLAttributes<HTMLFieldSetElement> {
    // section title
    legend: string | ReactNode;
    description?: string | ReactNode;
}

const SettingsFieldset: React.FC<Props> = ({ legend, className, children, description, ...rest }) => (
    <fieldset {...rest} className={classNames("mx_SettingsFieldset", className)}>
        <legend className="mx_SettingsFieldset_legend">{legend}</legend>
        {description && (
            <div className="mx_SettingsFieldset_description">
                <SettingsSubsectionText>{description}</SettingsSubsectionText>
            </div>
        )}
        <div className="mx_SettingsFieldset_content">{children}</div>
    </fieldset>
);

export default SettingsFieldset;
