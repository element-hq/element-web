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
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import dis from '../../../dispatcher/dispatcher';
import { _t } from '../../../languageHandler';
import { ActionPayload } from '../../../dispatcher/payloads';
import CallHandler, { AudioID } from '../../../CallHandler';
import RoomAvatar from '../avatars/RoomAvatar';
import AccessibleButton from '../elements/AccessibleButton';
import { CallState } from 'matrix-js-sdk/src/webrtc/call';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import AccessibleTooltipButton from '../elements/AccessibleTooltipButton';
import classNames from 'classnames';

interface IProps {
}

interface IState {
    incomingCall: any;
    silenced: boolean;
}

@replaceableComponent("views.voip.IncomingCallBox")
export default class IncomingCallBox extends React.Component<IProps, IState> {
    private dispatcherRef: string;

    constructor(props: IProps) {
        super(props);

        this.dispatcherRef = dis.register(this.onAction);
        this.state = {
            incomingCall: null,
            silenced: false,
        };
    }

    public componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload) => {
        switch (payload.action) {
            case 'call_state': {
                const call = CallHandler.sharedInstance().getCallForRoom(payload.room_id);
                if (call && call.state === CallState.Ringing) {
                    this.setState({
                        incomingCall: call,
                        silenced: false, // Reset silenced state for new call
                    });
                } else {
                    this.setState({
                        incomingCall: null,
                    });
                }
            }
        }
    };

    private onAnswerClick: React.MouseEventHandler = (e) => {
        e.stopPropagation();
        dis.dispatch({
            action: 'answer',
            room_id: CallHandler.sharedInstance().roomIdForCall(this.state.incomingCall),
        });
    };

    private onRejectClick: React.MouseEventHandler = (e) => {
        e.stopPropagation();
        dis.dispatch({
            action: 'reject',
            room_id: CallHandler.sharedInstance().roomIdForCall(this.state.incomingCall),
        });
    };

    private onSilenceClick: React.MouseEventHandler = (e) => {
        e.stopPropagation();
        const newState = !this.state.silenced;
        this.setState({ silenced: newState });
        newState ? CallHandler.sharedInstance().pause(AudioID.Ring) : CallHandler.sharedInstance().play(AudioID.Ring);
    };

    public render() {
        if (!this.state.incomingCall) {
            return null;
        }

        let room = null;
        if (this.state.incomingCall) {
            room = MatrixClientPeg.get().getRoom(CallHandler.sharedInstance().roomIdForCall(this.state.incomingCall));
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

        const silenceClass = classNames({
            "mx_IncomingCallBox_iconButton": true,
            "mx_IncomingCallBox_unSilence": this.state.silenced,
            "mx_IncomingCallBox_silence": !this.state.silenced,
        });

        return <div className="mx_IncomingCallBox">
            <div className="mx_IncomingCallBox_CallerInfo">
                <RoomAvatar
                    room={room}
                    height={32}
                    width={32}
                />
                <div>
                    <h1>{caller}</h1>
                    <p>{incomingCallText}</p>
                </div>
                <AccessibleTooltipButton
                    className={silenceClass}
                    onClick={this.onSilenceClick}
                    title={this.state.silenced ? _t("Sound on"): _t("Silence call")}
                />
            </div>
            <div className="mx_IncomingCallBox_buttons">
                <AccessibleButton
                    className={"mx_IncomingCallBox_decline"}
                    onClick={this.onRejectClick}
                    kind="danger"
                >
                    { _t("Decline") }
                </AccessibleButton>
                <div className="mx_IncomingCallBox_spacer" />
                <AccessibleButton
                    className={"mx_IncomingCallBox_accept"}
                    onClick={this.onAnswerClick}
                    kind="primary"
                >
                    { _t("Accept") }
                </AccessibleButton>
            </div>
        </div>;
    }
}
