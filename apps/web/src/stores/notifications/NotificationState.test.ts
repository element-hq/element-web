/*
 * Copyright 2026 hayaksi1
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";

import { type INotificationStateSnapshotParams, NotificationStateSnapshot } from "./NotificationState";
import { NotificationLevel } from "./NotificationLevel";

describe("NotificationStateSnapshot", () => {
    const idleState: INotificationStateSnapshotParams = {
        symbol: null,
        count: 0,
        level: NotificationLevel.None,
        muted: false,
        knocked: false,
        invited: false,
    };

    it("reports no difference when nothing has changed", () => {
        const snapshot = new NotificationStateSnapshot(idleState);

        expect(snapshot.isDifferentFrom(idleState)).toBe(false);
    });

    it.each<[string, Partial<INotificationStateSnapshotParams>]>([
        ["symbol", { symbol: "!" }],
        ["count", { count: 1 }],
        ["level", { level: NotificationLevel.Highlight }],
        ["muted", { muted: true }],
        ["knocked", { knocked: true }],
        ["invited", { invited: true }],
    ])("reports a difference when %s changes", (_field, change) => {
        const snapshot = new NotificationStateSnapshot(idleState);

        expect(snapshot.isDifferentFrom({ ...idleState, ...change })).toBe(true);
    });
});
