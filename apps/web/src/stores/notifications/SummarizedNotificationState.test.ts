/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";

import { SummarizedNotificationState } from "./SummarizedNotificationState";
import { StaticNotificationState } from "./StaticNotificationState";
import { NotificationLevel } from "./NotificationLevel";

describe("SummarizedNotificationState", () => {
    it("reports the unsent symbol when one of the summarized states failed to send", () => {
        const state = new SummarizedNotificationState();
        state.add(StaticNotificationState.forCount(12, NotificationLevel.Notification));
        state.add(new StaticNotificationState("!", 1, NotificationLevel.Unsent));

        expect(state.level).toBe(NotificationLevel.Unsent);
        expect(state.symbol).toBe("!");
    });

    it("keeps reporting the count when nothing failed to send", () => {
        const state = new SummarizedNotificationState();
        state.add(StaticNotificationState.forCount(12, NotificationLevel.Notification));

        expect(state.level).toBe(NotificationLevel.Notification);
        expect(state.symbol).toBeNull();
        expect(state.count).toBe(12);
    });

    it("still adopts an explicit symbol below the unsent level", () => {
        const state = new SummarizedNotificationState();
        state.add(StaticNotificationState.forSymbol("@", NotificationLevel.Highlight), true);

        expect(state.symbol).toBe("@");
    });
});
