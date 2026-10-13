/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { EventType } from "matrix-js-sdk/src/matrix";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { mkEvent, stubClient } from "test-utils";

import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { shouldHighlightEventTile } from "./EventTileHighlightState";

describe("shouldHighlightEventTile", () => {
    const cli = stubClient();
    const makeEvent = (sender = "@alice:example.org") =>
        mkEvent({
            event: true,
            id: "$event",
            room: "!room:example.org",
            type: EventType.RoomMessage,
            user: sender,
            content: { msgtype: "m.text", body: "Hello" },
        });

    beforeEach(() => {
        vi.mocked(cli.getPushActionsForEvent).mockReset();
    });

    it("highlights an event with a highlight push tweak", () => {
        const event = makeEvent();
        vi.mocked(cli.getPushActionsForEvent).mockReturnValue({ notify: true, tweaks: { highlight: true } });

        expect(
            shouldHighlightEventTile({
                cli,
                mxEvent: event,
                timelineRenderingType: TimelineRenderingType.Room,
            }),
        ).toBe(true);
    });

    it.each([
        ["exporting", { forExport: true }],
        ["a notification", { timelineRenderingType: TimelineRenderingType.Notification }],
        ["the threads list", { timelineRenderingType: TimelineRenderingType.ThreadsList }],
        ["a redacted event", { isRedacted: true }],
    ])("does not highlight while %s", (_description, overrides) => {
        const event = makeEvent();
        vi.mocked(cli.getPushActionsForEvent).mockReturnValue({ notify: true, tweaks: { highlight: true } });

        expect(
            shouldHighlightEventTile({
                cli,
                mxEvent: event,
                timelineRenderingType: TimelineRenderingType.Room,
                ...overrides,
            }),
        ).toBe(false);
        expect(cli.getPushActionsForEvent).not.toHaveBeenCalled();
    });

    it("does not highlight the current user's own event", () => {
        const event = makeEvent(cli.getSafeUserId());
        vi.mocked(cli.getPushActionsForEvent).mockReturnValue({ notify: true, tweaks: { highlight: true } });

        expect(
            shouldHighlightEventTile({
                cli,
                mxEvent: event,
                timelineRenderingType: TimelineRenderingType.Room,
            }),
        ).toBe(false);
    });

    it("retains the highlight from a replaced event", () => {
        const event = makeEvent();
        const replacement = makeEvent();
        event.makeReplaced(replacement);
        vi.mocked(cli.getPushActionsForEvent).mockImplementation((candidate) =>
            candidate === event ? { notify: true, tweaks: { highlight: true } } : { notify: false, tweaks: {} },
        );

        expect(
            shouldHighlightEventTile({
                cli,
                mxEvent: event,
                timelineRenderingType: TimelineRenderingType.Room,
            }),
        ).toBe(true);
    });
});
