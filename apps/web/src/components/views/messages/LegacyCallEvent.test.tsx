/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, vi, beforeEach, expect } from "vitest";
import { render, screen } from "test-utils-rtl";
import { CallErrorCode, CallState } from "matrix-js-sdk/src/webrtc/call";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import LegacyCallEvent from "./LegacyCallEvent";
import type LegacyCallEventGrouper from "../../structures/LegacyCallEventGrouper";

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
            addListener: vi.fn(),
            removeListener: vi.fn(),
            invite: vi.fn().mockReturnValue(callInviteEvent),
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
        callEventGrouper.gotRejected = vi.fn().mockReturnValue(true);

        renderEvent();

        expect(screen.getByText("Call declined")).toBeVisible();
    });

    it("shows if the call was answered elsewhere", () => {
        callEventGrouper.state = CallState.Ended;
        callEventGrouper.hangupReason = CallErrorCode.AnsweredElsewhere;

        renderEvent();

        expect(screen.getByText("Answered elsewhere")).toBeVisible();
    });

    it("shows if the call was missed", () => {
        callEventGrouper.state = CallState.Ended;
        callEventGrouper.callWasMissed = vi.fn().mockReturnValue(true);

        renderEvent();

        expect(screen.getByText("Missed call")).toBeVisible();
    });

    it("shows if the call ended cleanly", () => {
        callEventGrouper.state = CallState.Ended;
        callEventGrouper.hangupReason = CallErrorCode.UserHangup;

        renderEvent();

        expect(screen.getByText("Call ended")).toBeVisible();
    });

    it("shows if the call is connecting", () => {
        callEventGrouper.state = CallState.Connecting;

        renderEvent();

        expect(screen.getByText("Connecting")).toBeVisible();
    });

    it("shows timer if the call is connected", () => {
        callEventGrouper.state = CallState.Connected;

        renderEvent();

        expect(screen.getByText("00:00")).toBeVisible();
    });
});
