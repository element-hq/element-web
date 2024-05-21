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

import React, { ComponentProps, ReactNode } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { Playback, PlaybackState } from "../../../audio/Playback";
import AccessibleButton from "../elements/AccessibleButton";

type Props = Omit<ComponentProps<typeof AccessibleButton>, "title" | "onClick" | "disabled" | "element" | "ref"> & {
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
    public constructor(props: Props) {
        super(props);
    }

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
