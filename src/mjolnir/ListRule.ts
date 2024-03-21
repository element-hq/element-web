/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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
