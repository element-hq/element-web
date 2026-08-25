/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import InlineSpinner from "../elements/InlineSpinner";
import { _t } from "../../../languageHandler";
import RecordingPlayback from "../audio_messages/RecordingPlayback";
import MAudioBody from "./MAudioBody";
import MediaProcessingError from "./shared/MediaProcessingError";
import { isVoiceMessage } from "../../../utils/EventUtils";
import { PlaybackQueue } from "../../../audio/PlaybackQueue";
import { type Playback } from "../../../audio/Playback";
import RoomContext from "../../../contexts/RoomContext";
import { FileBodyFactory, renderMBody } from "./MBodyFactory";

export default class MVoiceMessageBody extends MAudioBody {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    private playbackQueue?: PlaybackQueue;

    protected onMount(playback: Playback): void {
        if (isVoiceMessage(this.props.mxEvent)) {
            this.playbackQueue = PlaybackQueue.forRoom(this.props.mxEvent.getRoomId()!, this.context.roomViewStore);
            this.playbackQueue.unsortedEnqueue(this.props.mxEvent, playback);
        }
    }

    protected onUnmount(): void {
        // The queue is the one kept from onMount rather than looked up again: unmounting can happen on
        // the way out of the session, and forRoom() reaches for a client which may already be gone.
        this.playbackQueue?.dequeue(this.props.mxEvent);
    }

    // A voice message is an audio file but rendered in a special way.
    public render(): React.ReactNode {
        if (this.state.error) {
            return (
                <MediaProcessingError className="mx_MVoiceMessageBody">
                    {_t("timeline|m.audio|error_processing_voice_message")}
                </MediaProcessingError>
            );
        }

        if (!this.state.playback) {
            return (
                <span className="mx_MVoiceMessageBody">
                    <InlineSpinner />
                </span>
            );
        }

        // At this point we should have a playable state
        return (
            <span className="mx_MVoiceMessageBody">
                <RecordingPlayback playback={this.state.playback} />
                {this.showFileBody && renderMBody({ ...this.props, showFileInfo: false }, FileBodyFactory)}
            </span>
        );
    }
}
