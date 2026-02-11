/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, type HTMLAttributes } from "react";
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
