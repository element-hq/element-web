/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import { type TagID } from "../models";
import { type OrderingAlgorithm } from "./list-ordering/OrderingAlgorithm";

export enum SortAlgorithm {
    Manual = "MANUAL",
    Alphabetic = "ALPHABETIC",
    Recent = "RECENT",
}

export enum ListAlgorithm {
    // Orders Red > Grey > Bold > Idle
    Importance = "IMPORTANCE",

    // Orders however the SortAlgorithm decides
    Natural = "NATURAL",
}

export interface ITagSortingMap {
    // @ts-ignore - TypeScript really wants this to be [tagId: string] but we know better.
    [tagId: TagID]: SortAlgorithm;
}

export interface IListOrderingMap {
    // @ts-ignore - TypeScript really wants this to be [tagId: string] but we know better.
    [tagId: TagID]: ListAlgorithm;
}

export interface IOrderingAlgorithmMap {
    // @ts-ignore - TypeScript really wants this to be [tagId: string] but we know better.
    [tagId: TagID]: OrderingAlgorithm;
}

export interface ITagMap {
    // @ts-ignore - TypeScript really wants this to be [tagId: string] but we know better.
    [tagId: TagID]: Room[];
}
