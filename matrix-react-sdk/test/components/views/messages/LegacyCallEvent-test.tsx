/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { render, screen } from "@testing-library/react";
import { CallErrorCode, CallState } from "matrix-js-sdk/src/webrtc/call";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import LegacyCallEvent from "../../../../src/components/views/messages/LegacyCallEvent";
import LegacyCallEventGrouper from "../../../../src/components/structures/LegacyCallEventGrouper";

const THEIR_USER_ID = "@them:here";

describe("LegacyCallEvent", () => {
    let callInviteEvent: Record<string, any>;
    let callEventGrouper: Record<string, any>;

    beforeEach(() => {
        callInviteEvent = {
            sender: {
                userId: THEIR_USER_ID,
            },
        };

        callEventGrouper = {
            addListener: jest.fn(),
            removeListener: jest.fn(),
            invite: jest.fn().mockReturnValue(callInviteEvent),
        };
    });

    const renderEvent = () => {
        render(
            <LegacyCallEvent
                mxEvent={callInviteEvent as unknown as MatrixEvent}
                callEventGrouper={callEventGrouper as unknown as LegacyCallEventGrouper}
            />,
        );
    };

    it("shows if the call was ended", () => {
        callEventGrouper.state = CallState.Ended;
        callEventGrouper.gotRejected = jest.fn().mockReturnValue(true);

        renderEvent();

        screen.getByText("Call declined");
    });

    it("shows if the call was answered elsewhere", () => {
        callEventGrouper.state = CallState.Ended;
        callEventGrouper.hangupReason = CallErrorCode.AnsweredElsewhere;

        renderEvent();

        screen.getByText("Answered elsewhere");
    });

    it("shows if the call was missed", () => {
        callEventGrouper.state = CallState.Ended;
        callEventGrouper.callWasMissed = jest.fn().mockReturnValue(true);

        renderEvent();

        screen.getByText("Missed call");
    });

    it("shows if the call ended cleanly", () => {
        callEventGrouper.state = CallState.Ended;
        callEventGrouper.hangupReason = CallErrorCode.UserHangup;

        renderEvent();

        screen.getByText("Call ended");
    });

    it("shows if the call is connecting", () => {
        callEventGrouper.state = CallState.Connecting;

        renderEvent();

        screen.getByText("Connecting");
    });

    it("shows timer if the call is connected", () => {
        callEventGrouper.state = CallState.Connected;

        renderEvent();

        screen.getByText("00:00");
    });
});
