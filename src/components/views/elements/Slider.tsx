/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import * as React from "react";
import { ChangeEvent } from "react";

interface IProps {
    // A callback for the selected value
    onChange: (value: number) => void;

    // The current value of the slider
    value: number;

    // The min and max of the slider
    min: number;
    max: number;
    // The step size of the slider, can be a number or "any"
    step: number | "any";

    // A function for formatting the values
    displayFunc: (value: number) => string;

    // Whether the slider is disabled
    disabled: boolean;

    label: string;
}

const THUMB_SIZE = 2.4; // em

export default class Slider extends React.Component<IProps> {
    private get position(): number {
        const { min, max, value } = this.props;
        return Number(((value - min) * 100) / (max - min));
    }

    private onChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        this.props.onChange(parseInt(ev.target.value, 10));
    };

    public render(): React.ReactNode {
        let selection: JSX.Element | undefined;

        if (!this.props.disabled) {
            const position = this.position;
            selection = (
                <output
                    className="mx_Slider_selection"
                    style={{
                        left: `calc(2px + ${position}% + ${THUMB_SIZE / 2}em - ${(position / 100) * THUMB_SIZE}em)`,
                    }}
                >
                    <span className="mx_Slider_selection_label">{this.props.value}</span>
                </output>
            );
        }

        return (
            <div className="mx_Slider">
                <input
                    type="range"
                    min={this.props.min}
                    max={this.props.max}
                    value={this.props.value}
                    onChange={this.onChange}
                    disabled={this.props.disabled}
                    step={this.props.step}
                    autoComplete="off"
                    aria-label={this.props.label}
                />
                {selection}
            </div>
        );
    }
}
