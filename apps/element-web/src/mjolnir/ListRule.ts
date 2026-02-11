/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// We are using experimental APIs here, so we need to disable the linter
// eslint-disable-next-line no-restricted-imports
import { PolicyRecommendation } from "matrix-js-sdk/src/models/invites-ignorer";

import { MatrixGlob } from "../utils/MatrixGlob";

// Inspiration largely taken from Mjolnir itself

export const RECOMMENDATION_BAN = PolicyRecommendation.Ban;
export const RECOMMENDATION_BAN_TYPES: PolicyRecommendation[] = [
    RECOMMENDATION_BAN,
    "org.matrix.mjolnir.ban" as PolicyRecommendation,
];

export function recommendationToStable(
    recommendation: PolicyRecommendation,
    unstable = true,
): PolicyRecommendation | null {
    if (RECOMMENDATION_BAN_TYPES.includes(recommendation)) {
        return unstable ? RECOMMENDATION_BAN_TYPES[RECOMMENDATION_BAN_TYPES.length - 1] : RECOMMENDATION_BAN;
    }
    return null;
}

export class ListRule {
    private _glob: MatrixGlob;
    private readonly _entity: string;
    private readonly _action: string | null;
    private readonly _reason: string;
    private readonly _kind: string;

    public constructor(entity: string, action: PolicyRecommendation, reason: string, kind: string) {
        this._glob = new MatrixGlob(entity);
        this._entity = entity;
        this._action = recommendationToStable(action, false);
        this._reason = reason;
        this._kind = kind;
    }

    public get entity(): string {
        return this._entity;
    }

    public get reason(): string {
        return this._reason;
    }

    public get kind(): string {
        return this._kind;
    }

    public get recommendation(): string | null {
        return this._action;
    }

    public isMatch(entity: string): boolean {
        return this._glob.test(entity);
    }
}
