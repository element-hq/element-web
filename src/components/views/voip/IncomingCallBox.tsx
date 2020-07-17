/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import dis from '../../../dispatcher/dispatcher';
import { _t } from '../../../languageHandler';
import { ActionPayload } from '../../../dispatcher/payloads';
import CallHandler from '../../../CallHandler';
import PulsedAvatar from '../avatars/PulsedAvatar';
import RoomAvatar from '../avatars/RoomAvatar';
import FormButton from '../elements/FormButton';

interface IProps {
}

interface IState {
    incomingCall: any;
}

export default class IncomingCallBox extends React.Component<IProps, IState> {
    private dispatcherRef: string;

    constructor(props: IProps) {
        super(props);

        this.dispatcherRef = dis.register(this.onAction);
        this.state = {
            incomingCall: null,
        };
    }

    public componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload) => {
        switch (payload.action) {
            case 'call_state':
                const call = CallHandler.getCall(payload.room_id);
                if (call && call.call_state === 'ringing') {
                    this.setState({
                        incomingCall: call,
                    });
                } else {
                    this.setState({
                        incomingCall: null,
                    });
                }
        }
    };

    private onAnswerClick: React.MouseEventHandler = (e) => {
        e.stopPropagation();
        dis.dispatch({
            action: 'answer',
            room_id: this.state.incomingCall.roomId,
        });
    };

    private onRejectClick: React.MouseEventHandler = (e) => {
        e.stopPropagation();
        dis.dispatch({
            action: 'hangup',
            room_id: this.state.incomingCall.roomId,
        });
    };

    public render() {
        if (!this.state.incomingCall) {
            return null;
        }

        let room = null;
        if (this.state.incomingCall) {
            room = MatrixClientPeg.get().getRoom(this.state.incomingCall.roomId);
        }

        const caller = room ? room.name : _t("Unknown caller");

        let incomingCallText = null;
        if (this.state.incomingCall) {
            if (this.state.incomingCall.type === "voice") {
                incomingCallText = _t("Incoming voice call");
            } else if (this.state.incomingCall.type === "video") {
                incomingCallText = _t("Incoming video call");
            } else {
                incomingCallText = _t("Incoming call");
            }
        }

        return <div className="mx_IncomingCallBox">
            <div className="mx_IncomingCallBox_CallerInfo">
                <PulsedAvatar>
                    <RoomAvatar
                        room={room}
                        height={32}
                        width={32}
                    />
                </PulsedAvatar>
                <div>
                    <h1>{caller}</h1>
                    <p>{incomingCallText}</p>
                </div>
            </div>
            <div className="mx_IncomingCallBox_buttons">
                <FormButton
                    className={"mx_IncomingCallBox_decline"}
                    onClick={this.onRejectClick}
                    kind="danger"
                    label={_t("Decline")}
                />
                <div className="mx_IncomingCallBox_spacer" />
                <FormButton
                    className={"mx_IncomingCallBox_accept"}
                    onClick={this.onAnswerClick}
                    kind="primary"
                    label={_t("Accept")}
                />
            </div>
        </div>;
    }
}

