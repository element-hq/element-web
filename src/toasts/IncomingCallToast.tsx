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

import CallHandler, { CallHandlerEvent } from '../CallHandler';
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

export default class IncomingCallToast extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            silenced: CallHandler.instance.isCallSilenced(this.props.call.callId),
        };
    }

    public componentDidMount = (): void => {
        CallHandler.instance.addListener(CallHandlerEvent.SilencedCallsChanged, this.onSilencedCallsChanged);
    };

    public componentWillUnmount(): void {
        CallHandler.instance.removeListener(CallHandlerEvent.SilencedCallsChanged, this.onSilencedCallsChanged);
    }

    private onSilencedCallsChanged = (): void => {
        this.setState({ silenced: CallHandler.instance.isCallSilenced(this.props.call.callId) });
    };

    private onAnswerClick = (e: React.MouseEvent): void => {
        e.stopPropagation();
        CallHandler.instance.answerCall(CallHandler.instance.roomIdForCall(this.props.call));
    };

    private onRejectClick= (e: React.MouseEvent): void => {
        e.stopPropagation();
        CallHandler.instance.hangupOrReject(CallHandler.instance.roomIdForCall(this.props.call), true);
    };

    private onSilenceClick = (e: React.MouseEvent): void => {
        e.stopPropagation();
        const callId = this.props.call.callId;
        this.state.silenced ?
            CallHandler.instance.unSilenceCall(callId) :
            CallHandler.instance.silenceCall(callId);
    };

    public render() {
        const call = this.props.call;
        const room = MatrixClientPeg.get().getRoom(CallHandler.instance.roomIdForCall(call));
        const isVoice = call.type === CallType.Voice;

        const contentClass = classNames("mx_IncomingCallToast_content", {
            "mx_IncomingCallToast_content_voice": isVoice,
            "mx_IncomingCallToast_content_video": !isVoice,
        });
        const silenceClass = classNames("mx_IncomingCallToast_iconButton", {
            "mx_IncomingCallToast_unSilence": this.state.silenced,
            "mx_IncomingCallToast_silence": !this.state.silenced,
        });

        return <React.Fragment>
            <RoomAvatar
                room={room}
                height={32}
                width={32}
            />
            <div className={contentClass}>
                <span className="mx_CallEvent_caller">
                    { room ? room.name : _t("Unknown caller") }
                </span>
                <div className="mx_CallEvent_type">
                    <div className="mx_CallEvent_type_icon" />
                    { isVoice ? _t("Voice call") : _t("Video call") }
                </div>
                <div className="mx_IncomingCallToast_buttons">
                    <AccessibleButton
                        className="mx_IncomingCallToast_button mx_IncomingCallToast_button_decline"
                        onClick={this.onRejectClick}
                        kind="danger"
                    >
                        <span> { _t("Decline") } </span>
                    </AccessibleButton>
                    <AccessibleButton
                        className="mx_IncomingCallToast_button mx_IncomingCallToast_button_accept"
                        onClick={this.onAnswerClick}
                        kind="primary"
                    >
                        <span> { _t("Accept") } </span>
                    </AccessibleButton>
                </div>
            </div>
            <AccessibleTooltipButton
                className={silenceClass}
                onClick={this.onSilenceClick}
                title={this.state.silenced ? _t("Sound on") : _t("Silence call")}
            />
        </React.Fragment>;
    }
}
