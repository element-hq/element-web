/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
