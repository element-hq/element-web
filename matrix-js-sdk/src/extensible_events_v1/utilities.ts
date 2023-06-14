/*
Copyright 2021 - 2023 The Matrix.org Foundation C.I.C.

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

import { Optional } from "matrix-events-sdk";

/**
 * Determines if the given optional was provided a value.
 * @param s - The optional to test.
 * @returns True if the value is defined.
 */
export function isProvided<T>(s: Optional<T>): boolean {
    return s !== null && s !== undefined;
}

/**
 * Determines if the given optional string is a defined string.
 * @param s - The input string.
 * @returns True if the input is a defined string.
 */
export function isOptionalAString(s: Optional<string>): s is string {
    return isProvided(s) && typeof s === "string";
}
