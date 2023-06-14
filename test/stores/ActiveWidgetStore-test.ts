/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import ActiveWidgetStore from "../../src/stores/ActiveWidgetStore";

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
