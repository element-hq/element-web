import "../../skinned-sdk";
import { stubClient } from '../../test-utils';
import { MatrixClientPeg } from '../../../src/MatrixClientPeg';
import { MatrixClient } from 'matrix-js-sdk';
import { EventType } from "matrix-js-sdk/src/@types/event";
import CallEventGrouper, { CustomCallState } from "../../../src/components/structures/CallEventGrouper";
import { CallState } from "matrix-js-sdk/src/webrtc/call";

const MY_USER_ID = "@me:here";
const THEIR_USER_ID = "@they:here";

let client: MatrixClient;

describe('CallEventGrouper', () => {
    beforeEach(() => {
        stubClient();
        client = MatrixClientPeg.get();
        client.getUserId = () => {
            return MY_USER_ID;
        };
    });

    it("detects a missed call", () => {
        const grouper = new CallEventGrouper();

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
        });

        expect(grouper.state).toBe(CustomCallState.Missed);
    });

    it("detects an ended call", () => {
        const grouperHangup = new CallEventGrouper();
        const grouperReject = new CallEventGrouper();

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
        });
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
        });

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
        });
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
        });

        expect(grouperHangup.state).toBe(CallState.Ended);
        expect(grouperReject.state).toBe(CallState.Ended);
    });

    it("detects call type", () => {
        const grouper = new CallEventGrouper();

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
        });

        expect(grouper.isVoice).toBe(false);
    });
});
