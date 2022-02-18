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

import React, { createRef } from 'react';
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { CallErrorCode, CallState } from 'matrix-js-sdk/src/webrtc/call';
import classNames from 'classnames';

import { _t } from '../../../languageHandler';
import MemberAvatar from '../avatars/MemberAvatar';
import CallEventGrouper, { CallEventGrouperEvent, CustomCallState } from '../../structures/CallEventGrouper';
import AccessibleButton from '../elements/AccessibleButton';
import InfoTooltip, { InfoTooltipKind } from '../elements/InfoTooltip';
import AccessibleTooltipButton from '../elements/AccessibleTooltipButton';
import { formatCallTime } from "../../../DateUtils";
import Clock from "../audio_messages/Clock";

const MAX_NON_NARROW_WIDTH = 450 / 70 * 100;

interface IProps {
    mxEvent: MatrixEvent;
    callEventGrouper: CallEventGrouper;
    timestamp?: JSX.Element;
}

interface IState {
    callState: CallState | CustomCallState;
    silenced: boolean;
    narrow: boolean;
    length: number;
}

export default class CallEvent extends React.PureComponent<IProps, IState> {
    private wrapperElement = createRef<HTMLDivElement>();
    private resizeObserver: ResizeObserver;

    constructor(props: IProps) {
        super(props);

        this.state = {
            callState: this.props.callEventGrouper.state,
            silenced: false,
            narrow: false,
            length: 0,
        };
    }

    componentDidMount() {
        this.props.callEventGrouper.addListener(CallEventGrouperEvent.StateChanged, this.onStateChanged);
        this.props.callEventGrouper.addListener(CallEventGrouperEvent.SilencedChanged, this.onSilencedChanged);
        this.props.callEventGrouper.addListener(CallEventGrouperEvent.LengthChanged, this.onLengthChanged);

        this.resizeObserver = new ResizeObserver(this.resizeObserverCallback);
        this.wrapperElement.current && this.resizeObserver.observe(this.wrapperElement.current);
    }

    componentWillUnmount() {
        this.props.callEventGrouper.removeListener(CallEventGrouperEvent.StateChanged, this.onStateChanged);
        this.props.callEventGrouper.removeListener(CallEventGrouperEvent.SilencedChanged, this.onSilencedChanged);
        this.props.callEventGrouper.removeListener(CallEventGrouperEvent.LengthChanged, this.onLengthChanged);

        this.resizeObserver.disconnect();
    }

    private onLengthChanged = (length: number): void => {
        this.setState({ length });
    };

    private resizeObserverCallback = (entries: ResizeObserverEntry[]): void => {
        const wrapperElementEntry = entries.find((entry) => entry.target === this.wrapperElement.current);
        if (!wrapperElementEntry) return;

        this.setState({ narrow: wrapperElementEntry.contentRect.width < MAX_NON_NARROW_WIDTH });
    };

    private onSilencedChanged = (newState) => {
        this.setState({ silenced: newState });
    };

    private onStateChanged = (newState: CallState) => {
        this.setState({ callState: newState });
    };

    private renderCallBackButton(text: string): JSX.Element {
        return (
            <AccessibleButton
                className="mx_CallEvent_content_button mx_CallEvent_content_button_callBack"
                onClick={this.props.callEventGrouper.callBack}
                kind="primary"
            >
                <span> { text } </span>
            </AccessibleButton>
        );
    }

    private renderSilenceIcon(): JSX.Element {
        const silenceClass = classNames({
            "mx_CallEvent_iconButton": true,
            "mx_CallEvent_unSilence": this.state.silenced,
            "mx_CallEvent_silence": !this.state.silenced,
        });

        return (
            <AccessibleTooltipButton
                className={silenceClass}
                onClick={this.props.callEventGrouper.toggleSilenced}
                title={this.state.silenced ? _t("Sound on") : _t("Silence call")}
            />
        );
    }

    private renderContent(state: CallState | CustomCallState): JSX.Element {
        if (state === CallState.Ringing) {
            let silenceIcon;
            if (!this.state.narrow) {
                silenceIcon = this.renderSilenceIcon();
            }

            return (
                <div className="mx_CallEvent_content">
                    { silenceIcon }
                    <AccessibleButton
                        className="mx_CallEvent_content_button mx_CallEvent_content_button_reject"
                        onClick={this.props.callEventGrouper.rejectCall}
                        kind="danger"
                    >
                        <span> { _t("Decline") } </span>
                    </AccessibleButton>
                    <AccessibleButton
                        className="mx_CallEvent_content_button mx_CallEvent_content_button_answer"
                        onClick={this.props.callEventGrouper.answerCall}
                        kind="primary"
                    >
                        <span> { _t("Accept") } </span>
                    </AccessibleButton>
                    { this.props.timestamp }
                </div>
            );
        }
        if (state === CallState.Ended) {
            const hangupReason = this.props.callEventGrouper.hangupReason;
            const gotRejected = this.props.callEventGrouper.gotRejected;

            if (gotRejected) {
                return (
                    <div className="mx_CallEvent_content">
                        { _t("Call declined") }
                        { this.renderCallBackButton(_t("Call back")) }
                        { this.props.timestamp }
                    </div>
                );
            } else if (([CallErrorCode.UserHangup, "user hangup"].includes(hangupReason) || !hangupReason)) {
                // workaround for https://github.com/vector-im/element-web/issues/5178
                // it seems Android randomly sets a reason of "user hangup" which is
                // interpreted as an error code :(
                // https://github.com/vector-im/riot-android/issues/2623
                // Also the correct hangup code as of VoIP v1 (with underscore)
                // Also, if we don't have a reason
                const duration = this.props.callEventGrouper.duration;
                let text = _t("Call ended");
                if (duration) {
                    text += " • " + formatCallTime(duration);
                }
                return (
                    <div className="mx_CallEvent_content">
                        { text }
                        { this.props.timestamp }
                    </div>
                );
            } else if (hangupReason === CallErrorCode.InviteTimeout) {
                return (
                    <div className="mx_CallEvent_content">
                        { _t("No answer") }
                        { this.renderCallBackButton(_t("Call back")) }
                        { this.props.timestamp }
                    </div>
                );
            }

            let reason;
            if (hangupReason === CallErrorCode.IceFailed) {
                // We couldn't establish a connection at all
                reason = _t("Could not connect media");
            } else if (hangupReason === "ice_timeout") {
                // We established a connection but it died
                reason = _t("Connection failed");
            } else if (hangupReason === CallErrorCode.NoUserMedia) {
                // The other side couldn't open capture devices
                reason = _t("Their device couldn't start the camera or microphone");
            } else if (hangupReason === "unknown_error") {
                // An error code the other side doesn't have a way to express
                // (as opposed to an error code they gave but we don't know about,
                // in which case we show the error code)
                reason = _t("An unknown error occurred");
            } else if (hangupReason === CallErrorCode.UserBusy) {
                reason = _t("The user you called is busy.");
            } else {
                reason = _t('Unknown failure: %(reason)s', { reason: hangupReason });
            }

            return (
                <div className="mx_CallEvent_content">
                    <InfoTooltip
                        tooltip={reason}
                        className="mx_CallEvent_content_tooltip"
                        kind={InfoTooltipKind.Warning}
                    />
                    { _t("Connection failed") }
                    { this.renderCallBackButton(_t("Retry")) }
                    { this.props.timestamp }
                </div>
            );
        }
        if (state === CallState.Connected) {
            return (
                <div className="mx_CallEvent_content">
                    <Clock seconds={this.state.length} aria-live="off" />
                    { this.props.timestamp }
                </div>
            );
        }
        if (state === CallState.Connecting) {
            return (
                <div className="mx_CallEvent_content">
                    { _t("Connecting") }
                    { this.props.timestamp }
                </div>
            );
        }
        if (state === CustomCallState.Missed) {
            return (
                <div className="mx_CallEvent_content">
                    { _t("Missed call") }
                    { this.renderCallBackButton(_t("Call back")) }
                    { this.props.timestamp }
                </div>
            );
        }

        return (
            <div className="mx_CallEvent_content">
                { _t("The call is in an unknown state!") }
                { this.props.timestamp }
            </div>
        );
    }

    public render(): JSX.Element {
        const event = this.props.mxEvent;
        const sender = event.sender ? event.sender.name : event.getSender();
        const isVoice = this.props.callEventGrouper.isVoice;
        const callType = isVoice ? _t("Voice call") : _t("Video call");
        const callState = this.state.callState;
        const hangupReason = this.props.callEventGrouper.hangupReason;
        const content = this.renderContent(callState);
        const className = classNames("mx_CallEvent", {
            mx_CallEvent_voice: isVoice,
            mx_CallEvent_video: !isVoice,
            mx_CallEvent_narrow: this.state.narrow,
            mx_CallEvent_missed: callState === CustomCallState.Missed,
            mx_CallEvent_noAnswer: callState === CallState.Ended && hangupReason === CallErrorCode.InviteTimeout,
            mx_CallEvent_rejected: callState === CallState.Ended && this.props.callEventGrouper.gotRejected,
        });
        let silenceIcon;
        if (this.state.narrow && this.state.callState === CallState.Ringing) {
            silenceIcon = this.renderSilenceIcon();
        }

        return (
            <div className="mx_CallEvent_wrapper" ref={this.wrapperElement}>
                <div className={className}>
                    { silenceIcon }
                    <div className="mx_CallEvent_info">
                        <MemberAvatar
                            member={event.sender}
                            width={32}
                            height={32}
                        />
                        <div className="mx_CallEvent_info_basic">
                            <div className="mx_CallEvent_sender">
                                { sender }
                            </div>
                            <div className="mx_CallEvent_type">
                                <div className="mx_CallEvent_type_icon" />
                                { callType }
                            </div>
                        </div>
                    </div>
                    { content }
                </div>
            </div>
        );
    }
}
