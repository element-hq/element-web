/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Relations } from "matrix-js-sdk/src/matrix";
import { type RelationsContainer } from "matrix-js-sdk/src/models/relations-container";

import { type PublicInterface } from "../@types/common";

export const mkRelations = (): Relations => {
    return {} as PublicInterface<Relations> as Relations;
};

export const mkRelationsContainer = (): RelationsContainer => {
    return {
        aggregateChildEvent: jest.fn(),
        aggregateParentEvent: jest.fn(),
        getAllChildEventsForEvent: jest.fn(),
        getChildEventsForEvent: jest.fn(),
    } as PublicInterface<RelationsContainer> as RelationsContainer;
};
