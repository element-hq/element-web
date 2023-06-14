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

import { buildFeatureSupportMap, Feature, ServerSupport } from "../../src/feature";

describe("Feature detection", () => {
    it("checks the matrix version", async () => {
        const support = await buildFeatureSupportMap({
            versions: ["v1.3"],
            unstable_features: {},
        });

        expect(support.get(Feature.Thread)).toBe(ServerSupport.Stable);
        expect(support.get(Feature.ThreadUnreadNotifications)).toBe(ServerSupport.Unsupported);
    });

    it("checks the matrix msc number", async () => {
        const support = await buildFeatureSupportMap({
            versions: ["v1.2"],
            unstable_features: {
                "org.matrix.msc3771": true,
                "org.matrix.msc3773": true,
            },
        });
        expect(support.get(Feature.ThreadUnreadNotifications)).toBe(ServerSupport.Unstable);
    });

    it("requires two MSCs to pass", async () => {
        const support = await buildFeatureSupportMap({
            versions: ["v1.2"],
            unstable_features: {
                "org.matrix.msc3771": false,
                "org.matrix.msc3773": true,
            },
        });
        expect(support.get(Feature.ThreadUnreadNotifications)).toBe(ServerSupport.Unsupported);
    });

    it("requires two MSCs OR matrix versions to pass", async () => {
        const support = await buildFeatureSupportMap({
            versions: ["v1.4"],
            unstable_features: {
                "org.matrix.msc3771": false,
                "org.matrix.msc3773": true,
            },
        });
        expect(support.get(Feature.ThreadUnreadNotifications)).toBe(ServerSupport.Stable);
    });
});
