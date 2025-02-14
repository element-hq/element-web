/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type CSSProperties } from "react";
import classNames from "classnames";

interface WaveformCSSProperties extends CSSProperties {
    "--barHeight": number;
}

interface IProps {
    relHeights: number[]; // relative heights (0-1)
    progress: number; // percent complete, 0-1, default 100%
}

/**
 * A simple waveform component. This renders bars (centered vertically) for each
 * height provided in the component properties. Updating the properties will update
 * the rendered waveform.
 *
 * For CSS purposes, a mx_Waveform_bar_100pct class is added when the bar should be
 * "filled", as a demonstration of the progress property.
 */
export default class Waveform extends React.PureComponent<IProps> {
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
