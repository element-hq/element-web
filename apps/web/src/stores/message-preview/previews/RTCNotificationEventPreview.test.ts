/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, afterEach, vi } from "vitest";
import { EventType } from "matrix-js-sdk/src/matrix";
import { mkEvent } from "test-utils";

import { RTCNotificationEventPreview } from "./RTCNotificationEventPreview";
import { CallStore } from "../../CallStore";
import { ElementCall } from "../../../models/Call";

describe("RTCNotificationEventPreview", () => {
    const preview = new RTCNotificationEventPreview();

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const mkNotification = () =>
        mkEvent({
            event: true,
            type: EventType.RTCNotification,
            content: {},
            user: "@other:example.com",
            room: "!room:example.com",
        });

    it("returns 'Call started' while the call is ongoing", () => {
        vi.spyOn(CallStore.instance, "getCall").mockReturnValue(Object.create(ElementCall.prototype));
        expect(preview.getTextFor(mkNotification())).toBe("Call started");
    });

    it("returns 'Call ended' when there is no call in the room", () => {
        vi.spyOn(CallStore.instance, "getCall").mockReturnValue(null);
        expect(preview.getTextFor(mkNotification())).toBe("Call ended");
    });
});
