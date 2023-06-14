/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

import React, { ReactNode } from "react";

/**
 * Joins an array into one value with a joiner. E.g. join(["hello", "world"], " ") -> <span>hello world</span>
 * @param array the array of element to join
 * @param joiner the string/JSX.Element to join with
 * @returns the joined array
 */
export function jsxJoin(array: ReactNode[], joiner?: string | JSX.Element): JSX.Element {
    const newArray: ReactNode[] = [];
    array.forEach((element, index) => {
        newArray.push(element, index === array.length - 1 ? null : joiner);
    });
    return <span>{newArray}</span>;
}
