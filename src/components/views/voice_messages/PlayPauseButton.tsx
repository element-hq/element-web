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

import React, {ReactNode} from "react";
import {replaceableComponent} from "../../../utils/replaceableComponent";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import {_t} from "../../../languageHandler";
import {Playback, PlaybackState} from "../../../voice/Playback";
import classNames from "classnames";

interface IProps {
    // Playback instance to manipulate. Cannot change during the component lifecycle.
    playback: Playback;

    // The playback phase to render. Able to change during the component lifecycle.
    playbackPhase: PlaybackState;
}

/**
 * Displays a play/pause button (activating the play/pause function of the recorder)
 * to be displayed in reference to a recording.
 */
@replaceableComponent("views.voice_messages.PlayPauseButton")
export default class PlayPauseButton extends React.PureComponent<IProps> {
    public constructor(props) {
        super(props);
    }

    private onClick = async () => {
        await this.props.playback.toggle();
    };

    public render(): ReactNode {
        const isPlaying = this.props.playback.isPlaying;
        const isDisabled = this.props.playbackPhase === PlaybackState.Decoding;
        const classes = classNames('mx_PlayPauseButton', {
            'mx_PlayPauseButton_play': !isPlaying,
            'mx_PlayPauseButton_pause': isPlaying,
            'mx_PlayPauseButton_disabled': isDisabled,
        });
        return <AccessibleTooltipButton
            className={classes}
            title={isPlaying ? _t("Pause") : _t("Play")}
            onClick={this.onClick}
            disabled={isDisabled}
        />;
    }
}
