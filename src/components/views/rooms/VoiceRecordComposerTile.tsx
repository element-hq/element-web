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
import {VoiceRecording} from "../../../voice/VoiceRecording";
import {Room} from "matrix-js-sdk/src/models/room";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import classNames from "classnames";
import LiveRecordingWaveform from "../voice_messages/LiveRecordingWaveform";
import {replaceableComponent} from "../../../utils/replaceableComponent";
import LiveRecordingClock from "../voice_messages/LiveRecordingClock";
import {VoiceRecordingStore} from "../../../stores/VoiceRecordingStore";

interface IProps {
    room: Room;
}

interface IState {
    recorder?: VoiceRecording;
}

/**
 * Container tile for rendering the voice message recorder in the composer.
 */
@replaceableComponent("views.rooms.VoiceRecordComposerTile")
export default class VoiceRecordComposerTile extends React.PureComponent<IProps, IState> {
    public constructor(props) {
        super(props);

        this.state = {
            recorder: null, // not recording by default
        };
    }

    private onStartStopVoiceMessage = async () => {
        // TODO: @@ TravisR: We do not want to auto-send on stop.
        if (this.state.recorder) {
            await this.state.recorder.stop();
            const mxc = await this.state.recorder.upload();
            MatrixClientPeg.get().sendMessage(this.props.room.roomId, {
                body: "Voice message",
                msgtype: "org.matrix.msc2516.voice",
                url: mxc,
            });
            await VoiceRecordingStore.instance.disposeRecording();
            this.setState({recorder: null});
            return;
        }
        const recorder = VoiceRecordingStore.instance.startRecording();
        await recorder.start();
        this.setState({recorder});
    };

    private renderWaveformArea() {
        if (!this.state.recorder) return null;

        return <div className='mx_VoiceRecordComposerTile_waveformContainer'>
            <LiveRecordingClock recorder={this.state.recorder} />
            <LiveRecordingWaveform recorder={this.state.recorder} />
        </div>;
    }

    public render() {
        const classes = classNames({
            'mx_MessageComposer_button': !this.state.recorder,
            'mx_MessageComposer_voiceMessage': !this.state.recorder,
            'mx_VoiceRecordComposerTile_stop': !!this.state.recorder,
        });

        let tooltip = _t("Record a voice message");
        if (!!this.state.recorder) {
            // TODO: @@ TravisR: Change to match behaviour
            tooltip = _t("Stop & send recording");
        }

        return (<>
            {this.renderWaveformArea()}
            <AccessibleTooltipButton
                className={classes}
                onClick={this.onStartStopVoiceMessage}
                title={tooltip}
            />
        </>);
    }
}
