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

import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import {_t} from "../../../languageHandler";
import React from "react";
import {VoiceRecorder} from "../../../voice/VoiceRecorder";
import {Room} from "matrix-js-sdk/src/models/room";
import {MatrixClientPeg} from "../../../MatrixClientPeg";

interface IProps {
    room: Room;
    onRecording: (haveRecording: boolean) => void;
}

interface IState {
    recorder?: VoiceRecorder;
}

export default class VoiceRecordComposerTile extends React.PureComponent<IProps, IState> {
    public constructor(props) {
        super(props);

        this.state = {
            recorder: null, // not recording by default
        };
    }

    private onStartVoiceMessage = async () => {
        if (this.state.recorder) {
            await this.state.recorder.stop();
            const mxc = await this.state.recorder.upload();
            MatrixClientPeg.get().sendMessage(this.props.room.roomId, {
                body: "Voice message",
                msgtype: "m.audio", // TODO
                url: mxc,
            });
            this.setState({recorder: null});
            this.props.onRecording(false);
            return;
        }
        const recorder = new VoiceRecorder(MatrixClientPeg.get());
        await recorder.start();
        this.props.onRecording(true);
        // TODO: Run through EQ component
        recorder.rawData.onUpdate((frame) => {
            console.log('@@ FRAME', frame);
        });
        this.setState({recorder});
    };

    public render() {
        return (
            <AccessibleTooltipButton
                className="mx_MessageComposer_button mx_MessageComposer_voiceMessage"
                onClick={this.onStartVoiceMessage}
                title={_t('Record a voice message')}
            />
        );
    }
}
