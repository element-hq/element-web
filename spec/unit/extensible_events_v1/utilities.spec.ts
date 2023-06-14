/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import { NamespacedValue } from "matrix-events-sdk";

import { isEventTypeSame } from "../../../src/@types/extensible_events";

describe("isEventTypeSame", () => {
    it("should match string and string", () => {
        const a = "org.example.message-like";
        const b = "org.example.different";

        expect(isEventTypeSame(a, b)).toBe(false);
        expect(isEventTypeSame(b, a)).toBe(false);

        expect(isEventTypeSame(a, a)).toBe(true);
        expect(isEventTypeSame(b, b)).toBe(true);
    });

    it("should match string and namespace", () => {
        const a = "org.example.message-like";
        const b = new NamespacedValue<string, string>("org.example.stable", "org.example.unstable");

        expect(isEventTypeSame(a, b)).toBe(false);
        expect(isEventTypeSame(b, a)).toBe(false);

        expect(isEventTypeSame(a, a)).toBe(true);
        expect(isEventTypeSame(b, b)).toBe(true);
        expect(isEventTypeSame(b.name, b)).toBe(true);
        expect(isEventTypeSame(b.altName, b)).toBe(true);
        expect(isEventTypeSame(b, b.name)).toBe(true);
        expect(isEventTypeSame(b, b.altName)).toBe(true);
    });

    it("should match namespace and namespace", () => {
        const a = new NamespacedValue<string, string>("org.example.stable1", "org.example.unstable1");
        const b = new NamespacedValue<string, string>("org.example.stable2", "org.example.unstable2");

        expect(isEventTypeSame(a, b)).toBe(false);
        expect(isEventTypeSame(b, a)).toBe(false);

        expect(isEventTypeSame(a, a)).toBe(true);
        expect(isEventTypeSame(a.name, a)).toBe(true);
        expect(isEventTypeSame(a.altName, a)).toBe(true);
        expect(isEventTypeSame(a, a.name)).toBe(true);
        expect(isEventTypeSame(a, a.altName)).toBe(true);

        expect(isEventTypeSame(b, b)).toBe(true);
        expect(isEventTypeSame(b.name, b)).toBe(true);
        expect(isEventTypeSame(b.altName, b)).toBe(true);
        expect(isEventTypeSame(b, b.name)).toBe(true);
        expect(isEventTypeSame(b, b.altName)).toBe(true);
    });

    it("should match namespaces of different pointers", () => {
        const a = new NamespacedValue<string, string>("org.example.stable", "org.example.unstable");
        const b = new NamespacedValue<string, string>("org.example.stable", "org.example.unstable");

        expect(isEventTypeSame(a, b)).toBe(true);
        expect(isEventTypeSame(b, a)).toBe(true);

        expect(isEventTypeSame(a, a)).toBe(true);
        expect(isEventTypeSame(a.name, a)).toBe(true);
        expect(isEventTypeSame(a.altName, a)).toBe(true);
        expect(isEventTypeSame(a, a.name)).toBe(true);
        expect(isEventTypeSame(a, a.altName)).toBe(true);

        expect(isEventTypeSame(b, b)).toBe(true);
        expect(isEventTypeSame(b.name, b)).toBe(true);
        expect(isEventTypeSame(b.altName, b)).toBe(true);
        expect(isEventTypeSame(b, b.name)).toBe(true);
        expect(isEventTypeSame(b, b.altName)).toBe(true);
    });
});
