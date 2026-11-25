/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export type PublicInterface<T> = {
    [P in keyof T]: T[P];
};

type FunctionLike = (...args: any[]) => any;

/** Keys of `T` whose value type is a function - equivalent to jest-mock's `MethodLikeKeys`. */
export type MethodLikeKeys<T> = keyof {
    [K in keyof T as Required<T>[K] extends FunctionLike ? K : never]: T[K];
};

/** Keys of `T` whose value type is not a function - equivalent to jest-mock's `PropertyLikeKeys`. */
export type PropertyLikeKeys<T> = Exclude<keyof T, MethodLikeKeys<T>>;
