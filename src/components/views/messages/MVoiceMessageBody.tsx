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
import {replaceableComponent} from "../../../utils/replaceableComponent";
import {Playback} from "../../../voice/Playback";
import MFileBody from "./MFileBody";
import InlineSpinner from '../elements/InlineSpinner';
import {_t} from "../../../languageHandler";
import {mediaFromContent} from "../../../customisations/Media";
import {decryptFile} from "../../../utils/DecryptFile";
import RecordingPlayback from "../voice_messages/RecordingPlayback";

interface IProps {
    mxEvent: MatrixEvent;
}

interface IState {
    error?: Error;
    playback?: Playback;
    decryptedBlob?: Blob;
}

@replaceableComponent("views.messages.MVoiceMessageBody")
export default class MVoiceMessageBody extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {};
    }

    public async componentDidMount() {
        let buffer: ArrayBuffer;
        const content = this.props.mxEvent.getContent();
        const media = mediaFromContent(content);
        if (media.isEncrypted) {
            try {
                const blob = await decryptFile(content.file);
                buffer = await blob.arrayBuffer();
                this.setState({decryptedBlob: blob});
            } catch (e) {
                this.setState({error: e});
                console.warn("Unable to decrypt voice message", e);
                return; // stop processing the audio file
            }
        } else {
            try {
                buffer = await media.downloadSource().then(r => r.blob()).then(r => r.arrayBuffer());
            } catch (e) {
                this.setState({error: e});
                console.warn("Unable to download voice message", e);
                return; // stop processing the audio file
            }
        }

        const waveform = content?.["org.matrix.msc1767.audio"]?.waveform?.map(p => p / 1024);

        // We should have a buffer to work with now: let's set it up
        const playback = new Playback(buffer, waveform);
        this.setState({ playback });
        // Note: the RecordingPlayback component will handle preparing the Playback class for us.
    }

    public componentWillUnmount() {
        this.state.playback?.destroy();
    }

    public render() {
        if (this.state.error) {
            // TODO: @@TR: Verify error state
            return (
                <span className="mx_MVoiceMessageBody">
                    <img src={require("../../../../res/img/warning.svg")} width="16" height="16" />
                    { _t("Error processing voice message") }
                </span>
            );
        }

        if (!this.state.playback) {
            // TODO: @@TR: Verify loading/decrypting state
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
                <MFileBody {...this.props} decryptedBlob={this.state.decryptedBlob} showGenericPlaceholder={false} />
            </span>
        )
    }
}
