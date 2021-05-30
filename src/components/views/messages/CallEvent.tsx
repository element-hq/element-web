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
import TimelineCallEventStore, {
    TimelineCall as TimelineCallSt,
    TimelineCallEventStoreEvent,
    TimelineCallState,
} from "../../../stores/TimelineCallEventStore";
import MemberAvatar from '../avatars/MemberAvatar';

interface IProps {
    mxEvent: MatrixEvent;
}

interface IState {
    callState: TimelineCallState;
}

export default class CallEvent extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            callState: null,
        }
    }

    componentDidMount() {
        TimelineCallEventStore.instance.addListener(TimelineCallEventStoreEvent.CallsChanged, this.onCallsChanged);
    }

    componentWillUnmount() {
        TimelineCallEventStore.instance.removeListener(TimelineCallEventStoreEvent.CallsChanged, this.onCallsChanged);
    }

    private onCallsChanged = (calls: Map<string, TimelineCallSt>) => {
        const callId = this.props.mxEvent.getContent().call_id;
        const call = calls.get(callId);
        if (!call) return;
        this.setState({callState: call.state});
    }

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
        const state = this.state.callState;

        return (
            <div className="mx_CallEvent">
                <MemberAvatar
                    member={event.sender}
                    width={32}
                    height={32}
                />
                <div className="mx_CallEvent_content">
                    <div className="mx_CallEvent_sender">
                        {sender}
                    </div>
                    <div className="mx_CallEvent_type">
                        { this.isVoice() ? _t("Voice call") : _t("Video call") }
                        { state ? state : TimelineCallState.Unknown }
                    </div>
                </div>
            </div>
        );
    }
}
