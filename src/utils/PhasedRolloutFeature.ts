/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { xxHash32 } from "js-xxhash";

/**
 * The PhasedRolloutFeature class is used to manage the phased rollout of a new feature.
 *
 * It uses a hash of the user's identifier and the feature name to determine if a feature is enabled for a specific user.
 * The rollout percentage determines the probability that a user will be enabled for the feature.
 * The feature will be enabled for all users if the rollout percentage is 100, and for no users if the percentage is 0.
 * If a user is enabled for a feature at x% rollout, it will also be for any greater than x percent.
 *
 * The process ensures a uniform distribution of enabled features across users.
 *
 * @property featureName - The name of the feature to be rolled out.
 * @property rolloutPercentage - The int percentage (0..100) of users for whom the feature should be enabled.
 */
export class PhasedRolloutFeature {
    public readonly featureName: string;
    private readonly rolloutPercentage: number;
    private readonly seed: number;

    public constructor(featureName: string, rolloutPercentage: number) {
        this.featureName = featureName;
        if (!Number.isInteger(rolloutPercentage) || rolloutPercentage < 0 || rolloutPercentage > 100) {
            throw new Error("Rollout percentage must be an integer between 0 and 100");
        }
        this.rolloutPercentage = rolloutPercentage;
        // We add the feature name for the seed to ensure that the hash is different for each feature
        this.seed = Array.from(featureName).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    }

    /**
     * Returns true if the feature should be enabled for the given user.
     * @param userIdentifier - Some unique identifier for the user, e.g. their user ID or device ID.
     */
    public isFeatureEnabled(userIdentifier: string): boolean {
        /*
         * We use a hash function to convert the unique user ID string into an integer.
         * This integer can then be used as a basis for deciding whether the user should have access to the new feature.
         * We need some hash with good uniform distribution properties, security is not a concern here.
         * We use xxHash32, which is fast and has good distribution properties.
         */
        const hash = xxHash32(userIdentifier, this.seed);
        // We use the hash modulo 100 to get a number between 0 and 99.
        // Modulo is simple and effective and the distribution should be uniform enough for our purposes.
        return hash % 100 < this.rolloutPercentage;
    }
}
