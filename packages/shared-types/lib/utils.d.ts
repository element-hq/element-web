/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Returns a union type of the keys of the Input type whose names start with the given string Str.
 */
export type KeysStartingWith<Input extends object, Str extends string> = {
    [P in keyof Input]: P extends `${Str}${infer _X}` ? P : never; // we don't use _X
}[keyof Input];

/**
 * Makes fields of T and its object children optional if they are defined in D.
 * Useful for generating the input type for a given function if it applies an object of defaults.
 */
export type Defaultize<P, D> = P extends any
    ? string extends keyof P
        ? P
        : Pick<P, Exclude<keyof P, keyof D>> &
              Partial<Pick<P, Extract<keyof P, keyof D>>> &
              Partial<Pick<D, Exclude<keyof D, keyof P>>>
    : never;

/**
 * Makes fields of T and its object children non-optional if they are defined in D.
 * Useful for generating a type which allows you to know which fields will be defined once you apply default values.
 */
export type ResolveDefaults<T, D> = {
    [K in keyof T as K extends keyof D ? K : never]-?: SafeIndex<D, K> extends object
        ? NonNullable<T[K]> extends any[]
            ? NonNullable<T[K]>
            : NonNullable<T[K]> extends object
              ? ResolveDefaults<NonNullable<T[K]>, SafeIndex<D, K>>
              : NonNullable<T[K]>
        : NonNullable<T[K]>;
} & {
    [K in keyof T as K extends keyof D ? never : K]: T[K];
} & {};

type SafeIndex<D, K> = K extends keyof D ? D[K] : never;

/**
 * Applies the `readonly` modifier to all fields of T and its object children.
 */
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

/**
 * Like `Partial` but requires at least one property to be present.
 */
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U];

/**
 * Returns a union type of the keys of the input Object type whose values are assignable to the given Item type.
 * Based on https://stackoverflow.com/a/57862073
 */
export type Assignable<Object, Item> = {
    [Key in keyof Object]: Object[Key] extends Item ? Key : never;
}[keyof Object];

/**
 * Like `Partial` but for applied to all nested objects.
 * Based on https://dev.to/perennialautodidact/adventures-in-typescript-deeppartial-2f2a
 */
export type DeepPartial<T> = T extends object
    ? {
          [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;
