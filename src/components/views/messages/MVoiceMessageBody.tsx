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
import MFileBody from "./MFileBody";
import MediaProcessingError from "./shared/MediaProcessingError";

export default class MVoiceMessageBody extends MAudioBody {
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
                {this.showFileBody && <MFileBody {...this.props} showGenericPlaceholder={false} />}
            </span>
        );
    }
}
