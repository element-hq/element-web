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

import * as React from 'react';

type IProps = {
        // A callback for the selected value
        onSelectionChange: (value: number) => void;

        // The current value of the slider
        value: number;

        // The range and values of the slider
        // Currently only supports an ascending, constant interval range
        values: number[];

        // A function for formatting the the values
        displayFunc: (value: number) => string;

        // Whether the slider is disabled
        disabled: boolean;
}

export default class Slider extends React.Component<IProps> {
    _offset(values: number[], value: number): number {
        const min = values[0];
        const max = values[values.length - 1];

        // Clamp value between min and max
        value = Math.min(Math.max(value, min), max);

        return (value - min) / (max - min) * 100;
    }

    render(): React.ReactNode {
        const dots = this.props.values.map(v =>
            <Dot active={v <= this.props.value}
                 label={this.props.displayFunc(v)}
                 onClick={this.props.disabled ? () => {} : () => this.props.onSelectionChange(v)}
                 key={v}
                 disabled={this.props.disabled}
            />);

        const offset = this._offset(this.props.values, this.props.value);

        return <div className="mx_Slider">
            <div>
                <div className="mx_Slider_bar">
                    <hr />
                    { this.props.disabled ?
                        null :
                        <div className="mx_Slider_selection">
                            <div className="mx_Slider_selectionDot" style={{left: "calc(-0.55rem + " + offset + "%)"}} />
                            <hr style={{width: offset + "%"}} />
                        </div>
                    }
                </div>
                <div className="mx_Slider_dotContainer">
                    {dots}
                </div>
            </div>
        </div>;
    }
}

type DotIProps = {
    // Callback for behavior onclick
    onClick: () => void,

    // Whether the dot should appear active
    active: boolean,

    // The label on the dot
    label: string,

    // Whether the slider is disabled
    disabled: boolean;
}

class Dot extends React.Component<DotIProps> {
    render(): React.ReactNode {
        let className = "mx_Slider_dot"
        if (!this.props.disabled && this.props.active) {
            className += " mx_Slider_dotActive";
        }

        return <span onClick={this.props.onClick} className="mx_Slider_dotValue">
            <div className={className} />
            <div className="mx_Slider_labelContainer">
                <div className="mx_Slider_label">
                    {this.props.label}
                </div>
            </div>
        </span>;
    }
}
