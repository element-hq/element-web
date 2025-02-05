/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { type Playback, PlaybackState } from "../../../audio/Playback";
import AccessibleButton, { type ButtonProps } from "../elements/AccessibleButton";

type Props = Omit<ButtonProps<"div">, "title" | "onClick" | "disabled" | "element" | "ref"> & {
    // Playback instance to manipulate. Cannot change during the component lifecycle.
    playback: Playback;

    // The playback phase to render. Able to change during the component lifecycle.
    playbackPhase: PlaybackState;
};

/**
 * Displays a play/pause button (activating the play/pause function of the recorder)
 * to be displayed in reference to a recording.
 */
export default class PlayPauseButton extends React.PureComponent<Props> {
    private onClick = (): void => {
        // noinspection JSIgnoredPromiseFromCall
        this.toggleState();
    };

    public async toggleState(): Promise<void> {
        await this.props.playback.toggle();
    }

    public render(): ReactNode {
        const { playback, playbackPhase, ...restProps } = this.props;
        const isPlaying = playback.isPlaying;
        const isDisabled = playbackPhase === PlaybackState.Decoding;
        const classes = classNames("mx_PlayPauseButton", {
            mx_PlayPauseButton_play: !isPlaying,
            mx_PlayPauseButton_pause: isPlaying,
            mx_PlayPauseButton_disabled: isDisabled,
        });

        return (
            <AccessibleButton
                data-testid="play-pause-button"
                className={classes}
                title={isPlaying ? _t("action|pause") : _t("action|play")}
                onClick={this.onClick}
                disabled={isDisabled}
                {...restProps}
            />
        );
    }
}
