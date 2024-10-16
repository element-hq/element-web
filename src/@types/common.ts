/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { JSXElementConstructor } from "react";

export type { NonEmptyArray, XOR, Writeable } from "matrix-js-sdk/src/matrix";

export type ComponentClass = keyof JSX.IntrinsicElements | JSXElementConstructor<any>;

export type { Leaves } from "matrix-web-i18n";

export type RecursivePartial<T> = {
    [P in keyof T]?: T[P] extends (infer U)[]
        ? RecursivePartial<U>[]
        : T[P] extends object
          ? RecursivePartial<T[P]>
          : T[P];
};

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

export type DeepReadonly<T> = T extends (infer R)[]
    ? DeepReadonlyArray<R>
    : T extends Function
      ? T
      : T extends object
        ? DeepReadonlyObject<T>
        : T;

interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> {}

type DeepReadonlyObject<T> = {
    readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];
