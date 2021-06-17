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
import { _t, _td } from '../../../languageHandler';
import MemberAvatar from '../avatars/MemberAvatar';
import CallEventGrouper, { CallEventGrouperEvent, CustomCallState } from '../../structures/CallEventGrouper';
import FormButton from '../elements/FormButton';
import { CallErrorCode, CallState } from 'matrix-js-sdk/src/webrtc/call';
import InfoTooltip, { InfoTooltipKind } from '../elements/InfoTooltip';

interface IProps {
    mxEvent: MatrixEvent;
    callEventGrouper: CallEventGrouper;
}

interface IState {
    callState: CallState | CustomCallState;
}

const TEXTUAL_STATES: Map<CallState | CustomCallState, string> = new Map([
    [CallState.Connected, _td("Connected")],
    [CallState.Connecting, _td("Connecting")],
]);

export default class CallEvent extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            callState: this.props.callEventGrouper.state,
        }
    }

    componentDidMount() {
        this.props.callEventGrouper.addListener(CallEventGrouperEvent.StateChanged, this.onStateChanged);
    }

    componentWillUnmount() {
        this.props.callEventGrouper.removeListener(CallEventGrouperEvent.StateChanged, this.onStateChanged);
    }

    private onStateChanged = (newState: CallState) => {
        this.setState({callState: newState});
    }

    private renderContent(state: CallState | CustomCallState): JSX.Element {
        if (state === CallState.Ringing) {
            return (
                <div className="mx_CallEvent_content">
                    <FormButton
                        onClick={ this.props.callEventGrouper.rejectCall }
                        kind="danger"
                        label={ _t("Decline") }
                    />
                    <FormButton
                        onClick={ this.props.callEventGrouper.answerCall }
                        kind="primary"
                        label={ _t("Accept") }
                    />
                </div>
            );
        }
        if (state === CallState.Ended) {
            const hangupReason = this.props.callEventGrouper.hangupReason;

            if ([CallErrorCode.UserHangup, "user hangup"].includes(hangupReason) || !hangupReason) {
                // workaround for https://github.com/vector-im/element-web/issues/5178
                // it seems Android randomly sets a reason of "user hangup" which is
                // interpreted as an error code :(
                // https://github.com/vector-im/riot-android/issues/2623
                // Also the correct hangup code as of VoIP v1 (with underscore)
                // Also, if we don't have a reason
                return (
                    <div className="mx_CallEvent_content">
                        { _t("This call has ended") }
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
            } else if (hangupReason === CallErrorCode.InviteTimeout) {
                reason = _t("No answer");
            } else if (hangupReason === CallErrorCode.UserBusy) {
                reason = _t("The user you called is busy.");
            } else {
                reason = _t('Unknown failure: %(reason)s)', {reason: hangupReason});
            }

            return (
                <div className="mx_CallEvent_content">
                    <InfoTooltip
                        tooltip={reason}
                        className="mx_CallEvent_content_tooltip"
                        kind={InfoTooltipKind.Warning}
                    />
                    { _t("This call has failed") }
                </div>
            );
        }
        if (Array.from(TEXTUAL_STATES.keys()).includes(state)) {
            return (
                <div className="mx_CallEvent_content">
                    { TEXTUAL_STATES.get(state) }
                </div>
            );
        }
        if (state === CustomCallState.Missed) {
            return (
                <div className="mx_CallEvent_content">
                    { _t("You missed this call") }
                    <FormButton
                        className="mx_CallEvent_content_callBack"
                        onClick={ this.props.callEventGrouper.callBack }
                        kind="primary"
                        label={ _t("Call back") }
                    />
                </div>
            );
        }

        return (
            <div className="mx_CallEvent_content">
                { _t("The call is in an unknown state!") }
            </div>
        );
    }

    render() {
        const event = this.props.mxEvent;
        const sender = event.sender ? event.sender.name : event.getSender();
        const callType = this.props.callEventGrouper.isVoice ? _t("Voice call") : _t("Video call");
        const content = this.renderContent(this.state.callState);

        return (
            <div className="mx_CallEvent">
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
                            { callType }
                        </div>
                    </div>
                </div>
                { content }
            </div>
        );
    }
}
