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
import {MatrixEvent} from "matrix-js-sdk/src/models/event";
import MAudioBody from "./MAudioBody";
import {replaceableComponent} from "../../../utils/replaceableComponent";
import SettingsStore from "../../../settings/SettingsStore";
import MVoiceMessageBody from "./MVoiceMessageBody";

interface IProps {
    mxEvent: MatrixEvent;
}

@replaceableComponent("views.messages.MVoiceOrAudioBody")
export default class MVoiceOrAudioBody extends React.PureComponent<IProps> {
    public render() {
        const isVoiceMessage = !!this.props.mxEvent.getContent()['org.matrix.msc2516.voice'];
        const voiceMessagesEnabled = SettingsStore.getValue("feature_voice_messages");
        if (isVoiceMessage && voiceMessagesEnabled) {
            return <MVoiceMessageBody {...this.props} />;
        } else {
            return <MAudioBody {...this.props} />;
        }
    }
}
