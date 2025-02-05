/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, type CSSProperties, type ReactNode } from "react";

import { type PlaybackInterface } from "../../../audio/Playback";
import { MarkedExecution } from "../../../utils/MarkedExecution";
import { percentageOf } from "../../../utils/numbers";
import { _t } from "../../../languageHandler";

interface IProps {
    // Playback instance to render. Cannot change during component lifecycle: create
    // an all-new component instead.
    playback: PlaybackInterface;

    // Tab index for the underlying component. Useful if the seek bar is in a managed state.
    // Defaults to zero.
    tabIndex?: number;

    disabled?: boolean;
}

interface IState {
    percentage: number;
}

interface ISeekCSS extends CSSProperties {
    "--fillTo": number;
}

const ARROW_SKIP_SECONDS = 5; // arbitrary

export default class SeekBar extends React.PureComponent<IProps, IState> {
    // We use an animation frame request to avoid overly spamming prop updates, even if we aren't
    // really using anything demanding on the CSS front.

    private animationFrameFn: MarkedExecution = new MarkedExecution(
        () => this.doUpdate(),
        () => requestAnimationFrame(() => this.animationFrameFn.trigger()),
    );

    public static defaultProps = {
        tabIndex: 0,
        disabled: false,
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {
            percentage: percentageOf(this.props.playback.timeSeconds, 0, this.props.playback.durationSeconds),
        };
    }

    public componentDidMount(): void {
        // We don't need to de-register: the class handles this for us internally
        this.props.playback.liveData.onUpdate(() => this.animationFrameFn.mark());
    }

    private doUpdate(): void {
        this.setState({
            percentage: percentageOf(this.props.playback.timeSeconds, 0, this.props.playback.durationSeconds),
        });
    }

    public left(): void {
        // noinspection JSIgnoredPromiseFromCall
        this.props.playback.skipTo(this.props.playback.timeSeconds - ARROW_SKIP_SECONDS);
    }

    public right(): void {
        // noinspection JSIgnoredPromiseFromCall
        this.props.playback.skipTo(this.props.playback.timeSeconds + ARROW_SKIP_SECONDS);
    }

    private onChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        // Thankfully, onChange is only called when the user changes the value, not when we
        // change the value on the component. We can use this as a reliable "skip to X" function.
        //
        // noinspection JSIgnoredPromiseFromCall
        this.props.playback.skipTo(Number(ev.target.value) * this.props.playback.durationSeconds);
    };

    private onMouseDown = (event: React.MouseEvent<Element, MouseEvent>): void => {
        // do not propagate mouse down events, because these should be handled by the seekbar
        event.stopPropagation();
    };

    public render(): ReactNode {
        // We use a range input to avoid having to re-invent accessibility handling on
        // a custom set of divs.
        return (
            <input
                type="range"
                className="mx_SeekBar"
                tabIndex={this.props.tabIndex}
                onChange={this.onChange}
                onMouseDown={this.onMouseDown}
                min={0}
                max={1}
                value={this.state.percentage}
                step={0.001}
                style={{ "--fillTo": this.state.percentage } as ISeekCSS}
                disabled={this.props.disabled}
                aria-label={_t("a11y|seek_bar_label")}
            />
        );
    }
}
