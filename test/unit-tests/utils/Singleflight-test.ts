/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Singleflight } from "../../../src/utils/Singleflight";

describe("Singleflight", () => {
    afterEach(() => {
        Singleflight.forgetAll();
    });

    it("should throw for bad context variables", () => {
        const permutations: [object | null, string | null][] = [
            [null, null],
            [{}, null],
            [null, "test"],
        ];
        for (const p of permutations) {
            expect(() => Singleflight.for(p[0], p[1])).toThrow("An instance and key must be supplied");
        }
    });

    it("should execute the function once", () => {
        const instance = {};
        const key = "test";
        const val = {}; // unique object for reference check
        const fn = jest.fn().mockReturnValue(val);
        const sf = Singleflight.for(instance, key);
        const r1 = sf.do(fn);
        expect(r1).toBe(val);
        expect(fn.mock.calls.length).toBe(1);
        const r2 = sf.do(fn);
        expect(r2).toBe(val);
        expect(fn.mock.calls.length).toBe(1);
    });

    it("should execute the function once, even with new contexts", () => {
        const instance = {};
        const key = "test";
        const val = {}; // unique object for reference check
        const fn = jest.fn().mockReturnValue(val);
        let sf = Singleflight.for(instance, key);
        const r1 = sf.do(fn);
        expect(r1).toBe(val);
        expect(fn.mock.calls.length).toBe(1);
        sf = Singleflight.for(instance, key); // RESET FOR TEST
        const r2 = sf.do(fn);
        expect(r2).toBe(val);
        expect(fn.mock.calls.length).toBe(1);
    });

    it("should execute the function twice if the result was forgotten", () => {
        const instance = {};
        const key = "test";
        const val = {}; // unique object for reference check
        const fn = jest.fn().mockReturnValue(val);
        const sf = Singleflight.for(instance, key);
        const r1 = sf.do(fn);
        expect(r1).toBe(val);
        expect(fn.mock.calls.length).toBe(1);
        sf.forget();
        const r2 = sf.do(fn);
        expect(r2).toBe(val);
        expect(fn.mock.calls.length).toBe(2);
    });

    it("should execute the function twice if the instance was forgotten", () => {
        const instance = {};
        const key = "test";
        const val = {}; // unique object for reference check
        const fn = jest.fn().mockReturnValue(val);
        const sf = Singleflight.for(instance, key);
        const r1 = sf.do(fn);
        expect(r1).toBe(val);
        expect(fn.mock.calls.length).toBe(1);
        Singleflight.forgetAllFor(instance);
        const r2 = sf.do(fn);
        expect(r2).toBe(val);
        expect(fn.mock.calls.length).toBe(2);
    });

    it("should execute the function twice if everything was forgotten", () => {
        const instance = {};
        const key = "test";
        const val = {}; // unique object for reference check
        const fn = jest.fn().mockReturnValue(val);
        const sf = Singleflight.for(instance, key);
        const r1 = sf.do(fn);
        expect(r1).toBe(val);
        expect(fn.mock.calls.length).toBe(1);
        Singleflight.forgetAll();
        const r2 = sf.do(fn);
        expect(r2).toBe(val);
        expect(fn.mock.calls.length).toBe(2);
    });
});
