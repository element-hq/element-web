/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

import React from 'react';

import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { _t } from '../../../languageHandler';

interface IProps {
    mxEvent: MatrixEvent;
}

interface IState {

}

export default class RoomCreate extends React.Component<IProps, IState> {
    private isVoice(): boolean {
        const event = this.props.mxEvent;

        // FIXME: Find a better way to determine this from the event?
        let isVoice = true;
        if (event.getContent().offer && event.getContent().offer.sdp &&
            event.getContent().offer.sdp.indexOf('m=video') !== -1) {
            isVoice = false;
        }

        return isVoice;
    }

    render() {
        const event = this.props.mxEvent;
        const sender = event.sender ? event.sender.name : event.getSender();

        return (
            <div className={"mx_CallEvent"}>
                <div className="mx_CallEvent_sender">
                    {sender}
                </div>
                <div className="mx_CallEvent_type">
                    { this.isVoice() ? _t("Voice call") : _t("Video call") }
                </div>
            </div>
        );
    }
}
