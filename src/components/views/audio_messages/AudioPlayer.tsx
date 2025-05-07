/*
Copyright 2024 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";

import PlayPauseButton from "./PlayPauseButton";
import { formatBytes } from "../../../utils/FormattingUtils";
import DurationClock from "./DurationClock";
import { _t } from "../../../languageHandler";
import SeekBar from "./SeekBar";
import PlaybackClock from "./PlaybackClock";
import AudioPlayerBase from "./AudioPlayerBase";
import { PlaybackState } from "../../../audio/Playback";

export default class AudioPlayer extends AudioPlayerBase {
    protected renderFileSize(): string | null {
        const bytes = this.props.playback.sizeBytes;
        if (!bytes) return null;

        // Not translated here - we're just presenting the data which should already
        // be translated if needed.
        return `(${formatBytes(bytes)})`;
    }

    protected renderComponent(): ReactNode {
        // tabIndex=0 to ensure that the whole component becomes a tab stop, where we handle keyboard
        // events for accessibility
        return (
            <div className="mx_MediaBody mx_AudioPlayer_container" tabIndex={0} onKeyDown={this.onKeyDown}>
                <div className="mx_AudioPlayer_primaryContainer">
                    <PlayPauseButton
                        playback={this.props.playback}
                        playbackPhase={this.state.playbackPhase}
                        tabIndex={-1} // prevent tabbing into the button
                        ref={this.playPauseRef}
                    />
                    <div className="mx_AudioPlayer_mediaInfo">
                        <span className="mx_AudioPlayer_mediaName">
                            {this.props.mediaName || _t("timeline|m.audio|unnamed_audio")}
                        </span>
                        <div className="mx_AudioPlayer_byline">
                            <DurationClock playback={this.props.playback} />
                            &nbsp; {/* easiest way to introduce a gap between the components */}
                            {this.renderFileSize()}
                        </div>
                    </div>
                </div>
                <div className="mx_AudioPlayer_seek">
                    <SeekBar
                        playback={this.props.playback}
                        tabIndex={-1} // prevent tabbing into the bar
                        disabled={this.state.playbackPhase === PlaybackState.Decoding}
                        ref={this.seekRef}
                    />
                    <PlaybackClock playback={this.props.playback} defaultDisplaySeconds={0} />
                </div>
            </div>
        );
    }
}
