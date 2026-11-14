/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";
import { M_POLL_END } from "matrix-js-sdk/src/matrix";
import { makePollEndEvent } from "test-utils";

import shouldHideEvent from "./shouldHideEvent";
import { type IRoomState } from "./components/structures/RoomView";

describe("shouldHideEvent", () => {
    it.each([M_POLL_END.name, M_POLL_END.altName])("does not hide %s events", (type) => {
        const event = makePollEndEvent("$poll:example.com", "!room:example.com", "@alice:example.com");
        event.event.type = type;

        expect(shouldHideEvent(event, {} as IRoomState)).toBe(false);
    });
});
