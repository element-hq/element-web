/*
Copyright 2024,2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classnames from "classnames";

import StyledCheckbox from "./StyledCheckbox";

interface IProps {
    // The value for the checkbox
    value: boolean;
    // The translated label for the checkbox
    label: string;
    // Optional translated string to show below the checkbox
    byline?: string;
    // Whether or not to disable the checkbox
    disabled?: boolean;
    // The function to call when the value changes
    onChange(checked: boolean): void;
    // Optional additional CSS class to apply to the label
    className?: string;
}

const LabelledCheckbox: React.FC<IProps> = ({ value, label, byline, disabled, onChange, className }) => {
    return (
        <div className={classnames("mx_LabelledCheckbox", className)}>
            <StyledCheckbox
                description={byline}
                disabled={disabled}
                checked={value}
                onChange={(e) => onChange(e.target.checked)}
            >
                <span className="mx_LabelledCheckbox_label">{label}</span>
            </StyledCheckbox>
        </div>
    );
};

export default LabelledCheckbox;
