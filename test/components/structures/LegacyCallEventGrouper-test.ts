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

import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { CallState } from "matrix-js-sdk/src/webrtc/call";

import { stubClient } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import LegacyCallEventGrouper from "../../../src/components/structures/LegacyCallEventGrouper";

const MY_USER_ID = "@me:here";
const THEIR_USER_ID = "@they:here";

let client: MatrixClient;

describe("LegacyCallEventGrouper", () => {
    beforeEach(() => {
        stubClient();
        client = MatrixClientPeg.safeGet();
        client.getUserId = () => {
            return MY_USER_ID;
        };
    });

    it("detects a missed call", () => {
        const grouper = new LegacyCallEventGrouper();

        // This assumes that the other party aborted the call by sending a hangup,
        // which is the usual case. Another possible test would be for the edge
        // case where there is only an expired invite event.
        grouper.add({
            getContent: () => {
                return {
                    call_id: "callId",
                };
            },
            getType: () => {
                return EventType.CallInvite;
            },
            sender: {
                userId: THEIR_USER_ID,
            },
        } as unknown as MatrixEvent);
        grouper.add({
            getContent: () => {
                return {
                    call_id: "callId",
                };
            },
            getType: () => {
                return EventType.CallHangup;
            },
            sender: {
                userId: THEIR_USER_ID,
            },
        } as unknown as MatrixEvent);

        expect(grouper.state).toBe(CallState.Ended);
        expect(grouper.callWasMissed).toBe(true);
    });

    it("detects an ended call", () => {
        const grouperHangup = new LegacyCallEventGrouper();
        const grouperReject = new LegacyCallEventGrouper();

        grouperHangup.add({
            getContent: () => {
                return {
                    call_id: "callId",
                };
            },
            getType: () => {
                return EventType.CallInvite;
            },
            sender: {
                userId: MY_USER_ID,
            },
        } as unknown as MatrixEvent);
        grouperHangup.add({
            getContent: () => {
                return {
                    call_id: "callId",
                };
            },
            getType: () => {
                return EventType.CallHangup;
            },
            sender: {
                userId: THEIR_USER_ID,
            },
        } as unknown as MatrixEvent);

        grouperReject.add({
            getContent: () => {
                return {
                    call_id: "callId",
                };
            },
            getType: () => {
                return EventType.CallInvite;
            },
            sender: {
                userId: MY_USER_ID,
            },
        } as unknown as MatrixEvent);
        grouperReject.add({
            getContent: () => {
                return {
                    call_id: "callId",
                };
            },
            getType: () => {
                return EventType.CallReject;
            },
            sender: {
                userId: THEIR_USER_ID,
            },
        } as unknown as MatrixEvent);

        expect(grouperHangup.state).toBe(CallState.Ended);
        expect(grouperReject.state).toBe(CallState.Ended);
    });

    it("detects call type", () => {
        const grouper = new LegacyCallEventGrouper();

        grouper.add({
            getContent: () => {
                return {
                    call_id: "callId",
                    offer: {
                        sdp: "this is definitely an SDP m=video",
                    },
                };
            },
            getType: () => {
                return EventType.CallInvite;
            },
        } as unknown as MatrixEvent);

        expect(grouper.isVoice).toBe(false);
    });
});
