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

import { Playback, PlaybackState } from "../../../voice/Playback";
import React, { createRef, ReactNode, RefObject } from "react";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import PlayPauseButton from "./PlayPauseButton";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { formatBytes } from "../../../utils/FormattingUtils";
import DurationClock from "./DurationClock";
import { Key } from "../../../Keyboard";
import { _t } from "../../../languageHandler";
import SeekBar from "./SeekBar";
import PlaybackClock from "./PlaybackClock";

interface IProps {
    // Playback instance to render. Cannot change during component lifecycle: create
    // an all-new component instead.
    playback: Playback;

    mediaName: string;
}

interface IState {
    playbackPhase: PlaybackState;
}

@replaceableComponent("views.audio_messages.AudioPlayer")
export default class AudioPlayer extends React.PureComponent<IProps, IState> {
    private playPauseRef: RefObject<PlayPauseButton> = createRef();
    private seekRef: RefObject<SeekBar> = createRef();

    constructor(props: IProps) {
        super(props);

        this.state = {
            playbackPhase: PlaybackState.Decoding, // default assumption
        };

        // We don't need to de-register: the class handles this for us internally
        this.props.playback.on(UPDATE_EVENT, this.onPlaybackUpdate);

        // Don't wait for the promise to complete - it will emit a progress update when it
        // is done, and it's not meant to take long anyhow.
        // noinspection JSIgnoredPromiseFromCall
        this.props.playback.prepare();
    }

    private onPlaybackUpdate = (ev: PlaybackState) => {
        this.setState({ playbackPhase: ev });
    };

    private onKeyDown = (ev: React.KeyboardEvent) => {
        // stopPropagation() prevents the FocusComposer catch-all from triggering,
        // but we need to do it on key down instead of press (even though the user
        // interaction is typically on press).
        if (ev.key === Key.SPACE) {
            ev.stopPropagation();
            this.playPauseRef.current?.toggleState();
        } else if (ev.key === Key.ARROW_LEFT) {
            ev.stopPropagation();
            this.seekRef.current?.left();
        } else if (ev.key === Key.ARROW_RIGHT) {
            ev.stopPropagation();
            this.seekRef.current?.right();
        }
    };

    protected renderFileSize(): string {
        const bytes = this.props.playback.sizeBytes;
        if (!bytes) return null;

        // Not translated here - we're just presenting the data which should already
        // be translated if needed.
        return `(${formatBytes(bytes)})`;
    }

    public render(): ReactNode {
        // tabIndex=0 to ensure that the whole component becomes a tab stop, where we handle keyboard
        // events for accessibility
        return <div className='mx_MediaBody mx_AudioPlayer_container' tabIndex={0} onKeyDown={this.onKeyDown}>
            <div className='mx_AudioPlayer_primaryContainer'>
                <PlayPauseButton
                    playback={this.props.playback}
                    playbackPhase={this.state.playbackPhase}
                    tabIndex={-1} // prevent tabbing into the button
                    ref={this.playPauseRef}
                />
                <div className='mx_AudioPlayer_mediaInfo'>
                    <span className='mx_AudioPlayer_mediaName'>
                        {this.props.mediaName || _t("Unnamed audio")}
                    </span>
                    <div className='mx_AudioPlayer_byline'>
                        <DurationClock playback={this.props.playback} />
                        &nbsp; {/* easiest way to introduce a gap between the components */}
                        { this.renderFileSize() }
                    </div>
                </div>
            </div>
            <div className='mx_AudioPlayer_seek'>
                <SeekBar
                    playback={this.props.playback}
                    tabIndex={-1} // prevent tabbing into the bar
                    playbackPhase={this.state.playbackPhase}
                    ref={this.seekRef}
                />
                <PlaybackClock playback={this.props.playback} defaultDisplaySeconds={0} />
            </div>
        </div>;
    }
}
