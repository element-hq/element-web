/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import { CallState } from "matrix-js-sdk/src/webrtc/call";

import { stubClient } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import LegacyCallEventGrouper from "../../../../src/components/structures/LegacyCallEventGrouper";

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
