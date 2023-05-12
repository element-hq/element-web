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

import React from "react";
import { CallType, MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import classNames from "classnames";

import LegacyCallHandler, { LegacyCallHandlerEvent } from "../LegacyCallHandler";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { _t } from "../languageHandler";
import RoomAvatar from "../components/views/avatars/RoomAvatar";
import AccessibleTooltipButton from "../components/views/elements/AccessibleTooltipButton";
import AccessibleButton, { ButtonEvent } from "../components/views/elements/AccessibleButton";

export const getIncomingLegacyCallToastKey = (callId: string): string => `call_${callId}`;

interface IProps {
    call: MatrixCall;
}

interface IState {
    silenced: boolean;
}

export default class IncomingLegacyCallToast extends React.Component<IProps, IState> {
    private readonly roomId: string;

    public constructor(props: IProps) {
        super(props);

        const roomId = LegacyCallHandler.instance.roomIdForCall(this.props.call);
        if (!roomId) {
            throw new Error("Unable to find room for incoming call");
        }
        this.roomId = roomId;

        this.state = {
            silenced: LegacyCallHandler.instance.isCallSilenced(this.props.call.callId),
        };
    }

    public componentDidMount = (): void => {
        LegacyCallHandler.instance.addListener(
            LegacyCallHandlerEvent.SilencedCallsChanged,
            this.onSilencedCallsChanged,
        );
    };

    public componentWillUnmount(): void {
        LegacyCallHandler.instance.removeListener(
            LegacyCallHandlerEvent.SilencedCallsChanged,
            this.onSilencedCallsChanged,
        );
    }

    private onSilencedCallsChanged = (): void => {
        this.setState({ silenced: LegacyCallHandler.instance.isCallSilenced(this.props.call.callId) });
    };

    private onAnswerClick = (e: ButtonEvent): void => {
        e.stopPropagation();
        LegacyCallHandler.instance.answerCall(this.roomId);
    };

    private onRejectClick = (e: ButtonEvent): void => {
        e.stopPropagation();
        LegacyCallHandler.instance.hangupOrReject(this.roomId, true);
    };

    private onSilenceClick = (e: ButtonEvent): void => {
        e.stopPropagation();
        const callId = this.props.call.callId;
        this.state.silenced
            ? LegacyCallHandler.instance.unSilenceCall(callId)
            : LegacyCallHandler.instance.silenceCall(callId);
    };

    public render(): React.ReactNode {
        const room = MatrixClientPeg.get().getRoom(this.roomId);
        const isVoice = this.props.call.type === CallType.Voice;
        const callForcedSilent = LegacyCallHandler.instance.isForcedSilent();

        let silenceButtonTooltip = this.state.silenced ? _t("Sound on") : _t("Silence call");
        if (callForcedSilent) {
            silenceButtonTooltip = _t("Notifications silenced");
        }

        const contentClass = classNames("mx_IncomingLegacyCallToast_content", {
            mx_IncomingLegacyCallToast_content_voice: isVoice,
            mx_IncomingLegacyCallToast_content_video: !isVoice,
        });
        const silenceClass = classNames("mx_IncomingLegacyCallToast_iconButton", {
            mx_IncomingLegacyCallToast_unSilence: this.state.silenced,
            mx_IncomingLegacyCallToast_silence: !this.state.silenced,
        });

        return (
            <React.Fragment>
                <RoomAvatar room={room ?? undefined} height={32} width={32} />
                <div className={contentClass}>
                    <span className="mx_LegacyCallEvent_caller">{room ? room.name : _t("Unknown caller")}</span>
                    <div className="mx_LegacyCallEvent_type">
                        <div className="mx_LegacyCallEvent_type_icon" />
                        {isVoice ? _t("Voice call") : _t("Video call")}
                    </div>
                    <div className="mx_IncomingLegacyCallToast_buttons">
                        <AccessibleButton
                            className="mx_IncomingLegacyCallToast_button mx_IncomingLegacyCallToast_button_decline"
                            onClick={this.onRejectClick}
                            kind="danger"
                        >
                            <span> {_t("Decline")} </span>
                        </AccessibleButton>
                        <AccessibleButton
                            className="mx_IncomingLegacyCallToast_button mx_IncomingLegacyCallToast_button_accept"
                            onClick={this.onAnswerClick}
                            kind="primary"
                        >
                            <span> {_t("Accept")} </span>
                        </AccessibleButton>
                    </div>
                </div>
                <AccessibleTooltipButton
                    className={silenceClass}
                    disabled={callForcedSilent}
                    onClick={this.onSilenceClick}
                    title={silenceButtonTooltip}
                />
            </React.Fragment>
        );
    }
}
