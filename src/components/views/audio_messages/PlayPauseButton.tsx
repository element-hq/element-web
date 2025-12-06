/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type HTMLAttributes, type ReactNode } from "react";
import { PlayPauseButton as SharedPlayPauseButton } from "@element-hq/web-shared-components";

import { type Playback, PlaybackState } from "../../../audio/Playback";

type Props = HTMLAttributes<HTMLButtonElement> & {
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
        void this.toggleState();
    };

    public async toggleState(): Promise<void> {
        await this.props.playback.toggle();
    }

    public render(): ReactNode {
        const { playback, playbackPhase, ...restProps } = this.props;

        return (
            <SharedPlayPauseButton
                data-testid="play-pause-button"
                className="mx_PlayPauseButton"
                togglePlay={this.onClick}
                playing={playback.isPlaying}
                disabled={playbackPhase === PlaybackState.Decoding}
                {...restProps}
            />
        );
    }
}
