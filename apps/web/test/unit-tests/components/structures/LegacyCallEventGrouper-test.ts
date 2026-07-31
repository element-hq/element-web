/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import { CallState } from "matrix-js-sdk/src/webrtc/call";

import { stubClient } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import LegacyCallEventGrouper from "../../../../src/components/structures/LegacyCallEventGrouper";
import { SDKContextClass } from "../../../../src/contexts/SDKContextClass.ts";

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

    it("should be able to answer call", () => {
        const grouper = new LegacyCallEventGrouper();
        grouper.add(
            new MatrixEvent({
                content: {
                    call_id: "callId",
                },
                type: EventType.CallInvite,
                sender: THEIR_USER_ID,
                room_id: "!room:server",
            }),
        );

        jest.spyOn(SDKContextClass.instance.legacyCallHandler, "answerCall");
        grouper.answerCall();
        expect(SDKContextClass.instance.legacyCallHandler.answerCall).toHaveBeenCalledWith("!room:server");
    });

    it("should be able to reject call", () => {
        const grouper = new LegacyCallEventGrouper();
        grouper.add(
            new MatrixEvent({
                content: {
                    call_id: "callId",
                },
                type: EventType.CallInvite,
                sender: THEIR_USER_ID,
                room_id: "!room:server",
            }),
        );

        jest.spyOn(SDKContextClass.instance.legacyCallHandler, "hangupOrReject");
        grouper.rejectCall();
        expect(SDKContextClass.instance.legacyCallHandler.hangupOrReject).toHaveBeenCalledWith("!room:server", true);
    });

    it("should be able to callback call", () => {
        const grouper = new LegacyCallEventGrouper();
        grouper.add(
            new MatrixEvent({
                content: {
                    call_id: "callId",
                },
                type: EventType.CallHangup,
                sender: THEIR_USER_ID,
                room_id: "!room:server",
            }),
        );

        jest.spyOn(SDKContextClass.instance.legacyCallHandler, "placeCall");
        grouper.callBack();
        expect(SDKContextClass.instance.legacyCallHandler.placeCall).toHaveBeenCalledWith("!room:server", "video");
    });

    it("should be able to toggle call silenced", () => {
        const grouper = new LegacyCallEventGrouper();
        grouper.add(
            new MatrixEvent({
                content: {
                    call_id: "callId",
                },
                type: EventType.CallHangup,
                sender: THEIR_USER_ID,
                room_id: "!room:server",
            }),
        );

        jest.spyOn(SDKContextClass.instance.legacyCallHandler, "unSilenceCall");
        jest.spyOn(SDKContextClass.instance.legacyCallHandler, "silenceCall");

        jest.spyOn(SDKContextClass.instance.legacyCallHandler, "isCallSilenced").mockReturnValue(false);
        grouper.toggleSilenced();
        expect(SDKContextClass.instance.legacyCallHandler.silenceCall).toHaveBeenCalledWith("callId");

        jest.spyOn(SDKContextClass.instance.legacyCallHandler, "isCallSilenced").mockReturnValue(true);
        grouper.toggleSilenced();
        expect(SDKContextClass.instance.legacyCallHandler.unSilenceCall).toHaveBeenCalledWith("callId");
    });
});
