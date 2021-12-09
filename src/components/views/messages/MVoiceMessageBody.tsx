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

import { replaceableComponent } from "../../../utils/replaceableComponent";
import InlineSpinner from '../elements/InlineSpinner';
import { _t } from "../../../languageHandler";
import RecordingPlayback from "../audio_messages/RecordingPlayback";
import MAudioBody from "./MAudioBody";
import MFileBody from "./MFileBody";

@replaceableComponent("views.messages.MVoiceMessageBody")
export default class MVoiceMessageBody extends MAudioBody {
    // A voice message is an audio file but rendered in a special way.
    public render() {
        if (this.state.error) {
            return (
                <span className="mx_MVoiceMessageBody">
                    <img src={require("../../../../res/img/warning.svg")} width="16" height="16" />
                    { _t("Error processing voice message") }
                </span>
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
                <RecordingPlayback playback={this.state.playback} tileShape={this.props.tileShape} />
                { this.props.tileShape && <MFileBody {...this.props} showGenericPlaceholder={false} /> }
            </span>
        );
    }
}
