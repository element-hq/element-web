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

import React from "react";

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
}

const LabelledCheckbox: React.FC<IProps> = ({ value, label, byline, disabled, onChange }) => {
    return (
        <label className="mx_LabelledCheckbox">
            <StyledCheckbox disabled={disabled} checked={value} onChange={(e) => onChange(e.target.checked)} />
            <div className="mx_LabelledCheckbox_labels">
                <span className="mx_LabelledCheckbox_label">{label}</span>
                {byline ? <span className="mx_LabelledCheckbox_byline">{byline}</span> : null}
            </div>
        </label>
    );
};

export default LabelledCheckbox;
