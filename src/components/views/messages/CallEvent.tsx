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
import { CallState } from 'matrix-js-sdk/src/webrtc/call';

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
    [CallState.Ended, _td("This call has ended")],
]);

export default class CallEvent extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            callState: this.props.callEventGrouper.getState(),
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

    render() {
        const event = this.props.mxEvent;
        const sender = event.sender ? event.sender.name : event.getSender();

        const state = this.state.callState;
        let content;
        if (state === CallState.Ringing) {
            content = (
                <div className="mx_CallEvent_content">
                    <FormButton
                        onClick={this.props.callEventGrouper.rejectCall}
                        kind="danger"
                        label={_t("Decline")}
                    />
                    <FormButton
                        onClick={this.props.callEventGrouper.answerCall}
                        kind="primary"
                        label={_t("Accept")}
                    />
                </div>
            );
        } else if (Array.from(TEXTUAL_STATES.keys()).includes(state)) {
            content = (
                <div className="mx_CallEvent_content">
                    { TEXTUAL_STATES.get(state) }
                </div>
            );
        } else if (state === CustomCallState.Missed) {
            content = (
                <div className="mx_CallEvent_content">
                    { _t("You missed this call") }
                    <FormButton
                        className="mx_CallEvent_content_callBack"
                        onClick={this.props.callEventGrouper.callBack}
                        kind="primary"
                        label={_t("Call back")}
                    />
                </div>
            );
        } else {
            content = (
                <div className="mx_CallEvent_content">
                    { "The call is in an unknown state!" }
                </div>
            );
        }

        return (
            <div className="mx_CallEvent">
                <div className="mx_CallEvent_info">
                    <MemberAvatar
                        member={event.sender}
                        width={32}
                        height={32}
                    />
                    <div className="mx_CallEvent_info_basic">
                        <div>
                            { sender }
                        </div>
                        <div className="mx_CallEvent_type">
                            { this.props.callEventGrouper.isVoice() ? _t("Voice call") : _t("Video call") }
                        </div>
                    </div>
                </div>
                { content }
            </div>
        );
    }
}
