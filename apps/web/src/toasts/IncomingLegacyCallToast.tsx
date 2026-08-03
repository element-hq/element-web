/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { CallType, type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import {
    EndCallIcon,
    VideoCallSolidIcon,
    VoiceCallSolidIcon,
    VolumeOffSolidIcon,
    VolumeOnSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { LegacyCallHandlerEvent } from "../LegacyCallHandler";
import { _t } from "../languageHandler";
import RoomAvatar from "../components/views/avatars/RoomAvatar";
import AccessibleButton, { type ButtonEvent } from "../components/views/elements/AccessibleButton";
import { getCallStateIcon } from "../components/views/messages/LegacyCallEvent.tsx";
import { SDKContext } from "../contexts/SDKContext.ts";

export const getIncomingLegacyCallToastKey = (callId: string): string => `call_${callId}`;

interface IProps {
    call: MatrixCall;
}

interface IState {
    silenced: boolean;
}

export default class IncomingLegacyCallToast extends React.Component<IProps, IState> {
    public static contextType = SDKContext;
    declare public context: React.ContextType<typeof SDKContext>;

    private readonly roomId: string;

    public constructor(props: IProps, context: React.ContextType<typeof SDKContext>) {
        super(props, context);

        const roomId = context.legacyCallHandler.roomIdForCall(this.props.call);
        if (!roomId) {
            throw new Error("Unable to find room for incoming call");
        }
        this.roomId = roomId;

        this.state = {
            silenced: context.legacyCallHandler.isCallSilenced(this.props.call.callId),
        };
    }

    public componentDidMount = (): void => {
        this.context.legacyCallHandler.addListener(
            LegacyCallHandlerEvent.SilencedCallsChanged,
            this.onSilencedCallsChanged,
        );
    };

    public componentWillUnmount(): void {
        this.context.legacyCallHandler.removeListener(
            LegacyCallHandlerEvent.SilencedCallsChanged,
            this.onSilencedCallsChanged,
        );
    }

    private onSilencedCallsChanged = (): void => {
        this.setState({ silenced: this.context.legacyCallHandler.isCallSilenced(this.props.call.callId) });
    };

    private onAnswerClick = (e: ButtonEvent): void => {
        e.stopPropagation();
        this.context.legacyCallHandler.answerCall(this.roomId);
    };

    private onRejectClick = (e: ButtonEvent): void => {
        e.stopPropagation();
        this.context.legacyCallHandler.hangupOrReject(this.roomId, true);
    };

    private onSilenceClick = (e: ButtonEvent): void => {
        e.stopPropagation();
        const callId = this.props.call.callId;
        if (this.state.silenced) {
            this.context.legacyCallHandler.unSilenceCall(callId);
        } else {
            this.context.legacyCallHandler.silenceCall(callId);
        }
    };

    public render(): React.ReactNode {
        const room = this.context.client?.getRoom(this.roomId);
        const isVoice = this.props.call.type === CallType.Voice;
        const callForcedSilent = this.context.legacyCallHandler.isForcedSilent();

        let silenceButtonTooltip = this.state.silenced ? _t("voip|unsilence") : _t("voip|silence");
        if (callForcedSilent) {
            silenceButtonTooltip = _t("voip|silenced");
        }

        return (
            <React.Fragment>
                <RoomAvatar room={room ?? undefined} size="32px" />
                <div className="mx_IncomingLegacyCallToast_content">
                    <span className="mx_LegacyCallEvent_caller">{room?.name ?? _t("voip|unknown_caller")}</span>
                    <div className="mx_LegacyCallEvent_type">
                        {getCallStateIcon(isVoice, undefined)}
                        {isVoice ? _t("voip|voice_call") : _t("voip|video_call")}
                    </div>
                    <div className="mx_IncomingLegacyCallToast_buttons">
                        <AccessibleButton
                            className="mx_IncomingLegacyCallToast_button"
                            onClick={this.onRejectClick}
                            kind="danger"
                        >
                            <EndCallIcon />
                            {_t("action|decline")}
                        </AccessibleButton>
                        <AccessibleButton
                            className="mx_IncomingLegacyCallToast_button"
                            onClick={this.onAnswerClick}
                            kind="primary"
                        >
                            {isVoice ? <VoiceCallSolidIcon /> : <VideoCallSolidIcon />}
                            {_t("action|accept")}
                        </AccessibleButton>
                    </div>
                </div>
                <AccessibleButton
                    className="mx_IncomingLegacyCallToast_iconButton"
                    disabled={callForcedSilent}
                    onClick={this.onSilenceClick}
                    title={silenceButtonTooltip}
                >
                    {this.state.silenced ? <VolumeOffSolidIcon /> : <VolumeOnSolidIcon />}
                </AccessibleButton>
            </React.Fragment>
        );
    }
}
