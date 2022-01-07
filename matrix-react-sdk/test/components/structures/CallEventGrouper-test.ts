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

import "../../skinned-sdk";
import { MatrixClient } from 'matrix-js-sdk';
import { EventType } from "matrix-js-sdk/src/@types/event";
import { CallState } from "matrix-js-sdk/src/webrtc/call";

import { stubClient } from '../../test-utils';
import { MatrixClientPeg } from '../../../src/MatrixClientPeg';
import CallEventGrouper, { CustomCallState } from "../../../src/components/structures/CallEventGrouper";

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
