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

import React from "react";
import {replaceableComponent} from "../../../utils/replaceableComponent";
import {VoiceRecording} from "../../../voice/VoiceRecording";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import {_t} from "../../../languageHandler";
import {Playback, PlaybackState} from "../../../voice/Playback";
import classNames from "classnames";
import {UPDATE_EVENT} from "../../../stores/AsyncStore";

interface IProps {
    recorder: VoiceRecording;
}

interface IState {
    playback: Playback;
    playbackPhase: PlaybackState;
}

/**
 * Displays a play/pause button (activating the play/pause function of the recorder)
 * to be displayed in reference to a recording.
 */
@replaceableComponent("views.voice_messages.PlayPauseButton")
export default class PlayPauseButton extends React.PureComponent<IProps, IState> {
    public constructor(props) {
        super(props);
        this.state = {
            playback: null, // not ready yet
            playbackPhase: PlaybackState.Decoding,
        };
    }

    public async componentDidMount() {
        const playback = await this.props.recorder.getPlayback();
        playback.on(UPDATE_EVENT, this.onPlaybackState);
        this.setState({
            playback: playback,

            // We know the playback is no longer decoding when we get here. It'll emit an update
            // before we've bound a listener, so we just update the state here.
            playbackPhase: PlaybackState.Stopped,
        });
    }

    public componentWillUnmount() {
        if (this.state.playback) this.state.playback.off(UPDATE_EVENT, this.onPlaybackState);
    }

    private onPlaybackState = (newState: PlaybackState) => {
        this.setState({playbackPhase: newState});
    };

    private onClick = async () => {
        if (!this.state.playback) return; // ignore for now
        await this.state.playback.toggle();
    };

    public render() {
        const isPlaying = this.state.playback?.isPlaying;
        const isDisabled = this.state.playbackPhase === PlaybackState.Decoding;
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
