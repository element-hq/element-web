/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { PhasedRolloutFeature } from "../../../src/utils/PhasedRolloutFeature";

describe("Test PhasedRolloutFeature", () => {
    function randomUserId() {
        const characters = "abcdefghijklmnopqrstuvwxyz0123456789.=_-/+";
        let result = "";
        const charactersLength = characters.length;
        const idLength = Math.floor(Math.random() * 15) + 6; // Random number between 6 and 20
        for (let i = 0; i < idLength; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return "@" + result + ":matrix.org";
    }

    function randomDeviceId() {
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let result = "";
        const charactersLength = characters.length;
        for (let i = 0; i < 10; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    it("should only accept valid percentage", () => {
        expect(() => new PhasedRolloutFeature("test", 0.8)).toThrow();
        expect(() => new PhasedRolloutFeature("test", -1)).toThrow();
        expect(() => new PhasedRolloutFeature("test", 123)).toThrow();
    });

    it("should enable for all if percentage is 100", () => {
        const phasedRolloutFeature = new PhasedRolloutFeature("test", 100);

        for (let i = 0; i < 1000; i++) {
            expect(phasedRolloutFeature.isFeatureEnabled(randomUserId())).toBeTruthy();
        }
    });

    it("should not enable for anyone if percentage is 0", () => {
        const phasedRolloutFeature = new PhasedRolloutFeature("test", 0);

        for (let i = 0; i < 1000; i++) {
            expect(phasedRolloutFeature.isFeatureEnabled(randomUserId())).toBeFalsy();
        }
    });

    it("should enable for more users if percentage grows", () => {
        let rolloutPercentage = 0;
        let previousBatch: string[] = [];
        const allUsers = new Array(1000).fill(0).map(() => randomDeviceId());

        while (rolloutPercentage <= 90) {
            rolloutPercentage += 10;
            const nextRollout = new PhasedRolloutFeature("test", rolloutPercentage);
            const nextBatch = allUsers.filter((userId) => nextRollout.isFeatureEnabled(userId));
            expect(previousBatch.length).toBeLessThan(nextBatch.length);
            expect(previousBatch.every((user) => nextBatch.includes(user))).toBeTruthy();
            previousBatch = nextBatch;
        }
    });

    it("should distribute differently depending on the feature name", () => {
        const allUsers = new Array(1000).fill(0).map(() => randomUserId());

        const featureARollout = new PhasedRolloutFeature("FeatureA", 50);
        const featureBRollout = new PhasedRolloutFeature("FeatureB", 50);

        const featureAUsers = allUsers.filter((userId) => featureARollout.isFeatureEnabled(userId));
        const featureBUsers = allUsers.filter((userId) => featureBRollout.isFeatureEnabled(userId));

        expect(featureAUsers).not.toEqual(featureBUsers);
    });
});
