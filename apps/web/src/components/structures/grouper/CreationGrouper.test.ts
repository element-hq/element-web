/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { describe, expect, it } from "vitest";

import { CreationGrouper } from "./CreationGrouper";
import { SeparatorKind, type WrappedEvent } from "../MessagePanel";
import type MessagePanel from "../MessagePanel";

describe("CreationGrouper", () => {
    const creator = "@alice:server";
    const panel = {
        readMarkerForEvent: () => null,
        wantsSeparator: () => SeparatorKind.None,
    } as unknown as MessagePanel;

    const wrap = (type: string, stateKey = "", sender = creator): WrappedEvent => ({
        event: new MatrixEvent({ type, sender, state_key: stateKey, room_id: "!room:server", content: {} }),
        shouldShow: true,
    });

    const createGrouper = (): CreationGrouper =>
        new CreationGrouper(panel, wrap(EventType.RoomCreate), null, undefined, null);

    it("groups configuration state events sent by the room creator", () => {
        expect(createGrouper().shouldGroup(wrap(EventType.RoomName))).toBe(true);
    });

    it("does not group calendar events sent by the room creator", () => {
        expect(createGrouper().shouldGroup(wrap(EventType.UnstableCalendarEvent, "event-uid"))).toBe(false);
    });
});
