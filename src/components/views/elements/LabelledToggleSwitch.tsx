/*
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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
import classNames from "classnames";
import { randomString } from "matrix-js-sdk/src/randomstring";

import ToggleSwitch from "./ToggleSwitch";
import { Caption } from "../typography/Caption";

interface IProps {
    // The value for the toggle switch
    "value": boolean;
    // The translated label for the switch
    "label": string;
    // The translated caption for the switch
    "caption"?: string;
    // Tooltip to display
    "tooltip"?: string;
    // Whether or not to disable the toggle switch
    "disabled"?: boolean;
    // True to put the toggle in front of the label
    // Default false.
    "toggleInFront"?: boolean;
    // Additional class names to append to the switch. Optional.
    "className"?: string;
    // The function to call when the value changes
    onChange(checked: boolean): void;

    "data-testid"?: string;
}

export default class LabelledToggleSwitch extends React.PureComponent<IProps> {
    private readonly id = `mx_LabelledToggleSwitch_${randomString(12)}`;

    public render(): React.ReactNode {
        // This is a minimal version of a SettingsFlag
        const { label, caption } = this.props;
        let firstPart = (
            <span className="mx_SettingsFlag_label">
                <div id={this.id}>{label}</div>
                {caption && <Caption id={`${this.id}_caption`}>{caption}</Caption>}
            </span>
        );
        let secondPart = (
            <ToggleSwitch
                checked={this.props.value}
                disabled={this.props.disabled}
                onChange={this.props.onChange}
                tooltip={this.props.tooltip}
                aria-labelledby={this.id}
                aria-describedby={caption ? `${this.id}_caption` : undefined}
            />
        );

        if (this.props.toggleInFront) {
            [firstPart, secondPart] = [secondPart, firstPart];
        }

        const classes = classNames("mx_SettingsFlag", this.props.className, {
            mx_SettingsFlag_toggleInFront: this.props.toggleInFront,
        });
        return (
            <div data-testid={this.props["data-testid"]} className={classes}>
                {firstPart}
                {secondPart}
            </div>
        );
    }
}
