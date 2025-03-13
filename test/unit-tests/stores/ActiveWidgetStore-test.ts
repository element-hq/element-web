/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import ActiveWidgetStore from "../../../src/stores/ActiveWidgetStore";

describe("ActiveWidgetStore", () => {
    const store = ActiveWidgetStore.instance;

    it("tracks docked and live tiles correctly", () => {
        expect(store.isDocked("1", "r1")).toEqual(false);
        expect(store.isLive("1", "r1")).toEqual(false);

        // Try undocking the widget before it gets docked
        store.undockWidget("1", "r1");
        expect(store.isDocked("1", "r1")).toEqual(false);
        expect(store.isLive("1", "r1")).toEqual(false);

        store.dockWidget("1", "r1");
        expect(store.isDocked("1", "r1")).toEqual(true);
        expect(store.isLive("1", "r1")).toEqual(true);

        store.dockWidget("1", "r1");
        expect(store.isDocked("1", "r1")).toEqual(true);
        expect(store.isLive("1", "r1")).toEqual(true);

        store.undockWidget("1", "r1");
        expect(store.isDocked("1", "r1")).toEqual(true);
        expect(store.isLive("1", "r1")).toEqual(true);

        // Ensure that persistent widgets remain live even while undocked
        store.setWidgetPersistence("1", "r1", true);
        store.undockWidget("1", "r1");
        expect(store.isDocked("1", "r1")).toEqual(false);
        expect(store.isLive("1", "r1")).toEqual(true);

        store.setWidgetPersistence("1", "r1", false);
        expect(store.isDocked("1", "r1")).toEqual(false);
        expect(store.isLive("1", "r1")).toEqual(false);
    });
});
