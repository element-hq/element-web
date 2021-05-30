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


import { EventType } from "matrix-js-sdk/src/@types/event";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

export interface TimelineCallState {
    callId: string;
    isVoice: boolean;
}

export default class CallEventGrouper {
    invite: MatrixEvent;
    callId: string;

    private isVoice(): boolean {
        const invite = this.invite;

        // FIXME: Find a better way to determine this from the event?
        let isVoice = true;
        if (
            invite.getContent().offer && invite.getContent().offer.sdp &&
            invite.getContent().offer.sdp.indexOf('m=video') !== -1
        ) {
            isVoice = false;
        }

        return isVoice;
    }

    public add(event: MatrixEvent) {
        if (event.getType() === EventType.CallInvite) this.invite = event;
        this.callId = event.getContent().call_id;
    }

    public getState(): TimelineCallState {
        return {
            isVoice: this.isVoice(),
            callId: this.callId,
        }
    }
}
