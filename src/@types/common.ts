/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type JSX, type JSXElementConstructor } from "react";

export type { NonEmptyArray, XOR, Writeable } from "matrix-js-sdk/src/matrix";

export type ComponentClass = keyof JSX.IntrinsicElements | JSXElementConstructor<any>;

export type { Leaves } from "matrix-web-i18n";

export type KeysStartingWith<Input extends object, Str extends string> = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    [P in keyof Input]: P extends `${Str}${infer _X}` ? P : never; // we don't use _X
}[keyof Input];

export type Defaultize<P, D> = P extends any
    ? string extends keyof P
        ? P
        : Pick<P, Exclude<keyof P, keyof D>> &
              Partial<Pick<P, Extract<keyof P, keyof D>>> &
              Partial<Pick<D, Exclude<keyof D, keyof P>>>
    : never;

/* eslint-disable @typescript-eslint/no-unsafe-function-type */
export type DeepReadonly<T> = T extends (infer R)[]
    ? DeepReadonlyArray<R>
    : T extends Function
      ? T
      : T extends object
        ? DeepReadonlyObject<T>
        : T;
/* eslint-enable @typescript-eslint/no-unsafe-function-type */

interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

type DeepReadonlyObject<T> = {
    readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

/**
 * Returns a union type of the keys of the input Object type whose values are assignable to the given Item type.
 * Based on https://stackoverflow.com/a/57862073
 */
export type Assignable<Object, Item> = {
    [Key in keyof Object]: Object[Key] extends Item ? Key : never;
}[keyof Object];
