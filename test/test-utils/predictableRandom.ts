/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Fake random strings to give a predictable snapshot for IDs
// Simple Xorshift random number generator with predictable ID
export class PredictableRandom {
    private state: number;

    constructor() {
        this.state = 314159265;
    }

    get(): number {
        this.state ^= this.state << 13;
        this.state ^= this.state >> 17;
        this.state ^= this.state << 5;
        return this.state / 1073741823;
    }

    reset(): void {
        this.state = 314159265;
    }
}
