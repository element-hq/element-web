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

import React, { CSSProperties } from "react";
import classNames from "classnames";

interface WaveformCSSProperties extends CSSProperties {
    "--barHeight": number;
}

interface IProps {
    relHeights: number[]; // relative heights (0-1)
    progress: number; // percent complete, 0-1, default 100%
}

interface IState {}

/**
 * A simple waveform component. This renders bars (centered vertically) for each
 * height provided in the component properties. Updating the properties will update
 * the rendered waveform.
 *
 * For CSS purposes, a mx_Waveform_bar_100pct class is added when the bar should be
 * "filled", as a demonstration of the progress property.
 */
export default class Waveform extends React.PureComponent<IProps, IState> {
    public static defaultProps = {
        progress: 1,
    };

    public render(): React.ReactNode {
        return (
            <div className="mx_Waveform">
                {this.props.relHeights.map((h, i) => {
                    const progress = this.props.progress;
                    const isCompleteBar = i / this.props.relHeights.length <= progress && progress > 0;
                    const classes = classNames({
                        mx_Waveform_bar: true,
                        mx_Waveform_bar_100pct: isCompleteBar,
                    });
                    return (
                        <span
                            key={i}
                            style={
                                {
                                    "--barHeight": h,
                                } as WaveformCSSProperties
                            }
                            className={classes}
                        />
                    );
                })}
            </div>
        );
    }
}
