/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
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
import { CallType, MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import classNames from 'classnames';
import { replaceableComponent } from '../utils/replaceableComponent';
import CallHandler, { CallHandlerEvent } from '../CallHandler';
import dis from '../dispatcher/dispatcher';
import { MatrixClientPeg } from '../MatrixClientPeg';
import { _t } from '../languageHandler';
import RoomAvatar from '../components/views/avatars/RoomAvatar';
import AccessibleTooltipButton from '../components/views/elements/AccessibleTooltipButton';
import AccessibleButton from '../components/views/elements/AccessibleButton';

export const getIncomingCallToastKey = (callId: string) => `call_${callId}`;

interface IProps {
    call: MatrixCall;
}

interface IState {
    silenced: boolean;
}

@replaceableComponent("views.voip.IncomingCallToast")
export default class IncomingCallToast extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            silenced: false,
        };
    }

    componentDidMount = () => {
        CallHandler.sharedInstance().addListener(CallHandlerEvent.SilencedCallsChanged, this.onSilencedCallsChanged);
    };

    public componentWillUnmount() {
        CallHandler.sharedInstance().removeListener(CallHandlerEvent.SilencedCallsChanged, this.onSilencedCallsChanged);
    }

    private onSilencedCallsChanged = () => {
        this.setState({ silenced: CallHandler.sharedInstance().isCallSilenced(this.props.call.callId) });
    };

    private onAnswerClick= (e: React.MouseEvent) => {
        e.stopPropagation();
        dis.dispatch({
            action: 'answer',
            room_id: CallHandler.sharedInstance().roomIdForCall(this.props.call),
        });
    };

    private onRejectClick= (e: React.MouseEvent) => {
        e.stopPropagation();
        dis.dispatch({
            action: 'reject',
            room_id: CallHandler.sharedInstance().roomIdForCall(this.props.call),
        });
    };

    private onSilenceClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const callId = this.props.call.callId;
        this.state.silenced ?
            CallHandler.sharedInstance().unSilenceCall(callId) :
            CallHandler.sharedInstance().silenceCall(callId);
    };

    public render() {
        const call = this.props.call;
        let room = null;
        room = MatrixClientPeg.get().getRoom(CallHandler.sharedInstance().roomIdForCall(call));

        const caller = room ? room.name : _t("Unknown caller");

        const incomingCallText = call.type === CallType.Voice ? _t("Incoming voice call") : _t("Incoming video call");

        const silenceClass = classNames({
            "mx_IncomingCallToast_iconButton": true,
            "mx_IncomingCallToast_unSilence": this.state.silenced,
            "mx_IncomingCallToast_silence": !this.state.silenced,
        });

        return <React.Fragment>
            <div className="mx_IncomingCallToast_CallerInfo">
                <RoomAvatar
                    room={room}
                    height={32}
                    width={32}
                />
                <div>
                    <h1>{ caller }</h1>
                    <p>{ incomingCallText }</p>
                </div>
                <AccessibleTooltipButton
                    className={silenceClass}
                    onClick={this.onSilenceClick}
                    title={this.state.silenced ? _t("Sound on") : _t("Silence call")}
                />
            </div>
            <div className="mx_IncomingCallToast_buttons">
                <AccessibleButton
                    className="mx_IncomingCallToast_decline"
                    onClick={this.onRejectClick}
                    kind="danger"
                >
                    { _t("Decline") }
                </AccessibleButton>
                <AccessibleButton
                    className="mx_IncomingCallToast_accept"
                    onClick={this.onAnswerClick}
                    kind="primary"
                >
                    { _t("Accept") }
                </AccessibleButton>
            </div>
        </React.Fragment>;
    }
}
