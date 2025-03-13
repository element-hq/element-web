/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SnakedObject, snakeToCamel } from "../../../src/utils/SnakedObject";

describe("snakeToCamel", () => {
    it("should convert snake_case to camelCase in simple scenarios", () => {
        expect(snakeToCamel("snake_case")).toBe("snakeCase");
        expect(snakeToCamel("snake_case_but_longer")).toBe("snakeCaseButLonger");
        expect(snakeToCamel("numbered_123")).toBe("numbered123"); // not a thing we would see normally
    });

    // Not really something we expect to see, but it's defined behaviour of the function
    it("should not camelCase a trailing or leading underscore", () => {
        expect(snakeToCamel("_snake")).toBe("_snake");
        expect(snakeToCamel("snake_")).toBe("snake_");
        expect(snakeToCamel("_snake_case")).toBe("_snakeCase");
        expect(snakeToCamel("snake_case_")).toBe("snakeCase_");
    });

    // Another thing we don't really expect to see, but is "defined behaviour"
    it("should be predictable with double underscores", () => {
        expect(snakeToCamel("__snake__")).toBe("_Snake_");
        expect(snakeToCamel("snake__case")).toBe("snake_case");
    });
});

describe("SnakedObject", () => {
    /* eslint-disable camelcase*/
    const input = {
        snake_case: "woot",
        snakeCase: "oh no", // ensure different value from snake_case for tests
        camelCase: "fallback",
    };
    const snake = new SnakedObject(input);
    /* eslint-enable camelcase*/

    it("should prefer snake_case keys", () => {
        expect(snake.get("snake_case")).toBe(input.snake_case);
        expect(snake.get("snake_case", "camelCase")).toBe(input.snake_case);
    });

    it("should fall back to camelCase keys when needed", () => {
        // @ts-ignore - we're deliberately supplying a key that doesn't exist
        expect(snake.get("camel_case")).toBe(input.camelCase);

        // @ts-ignore - we're deliberately supplying a key that doesn't exist
        expect(snake.get("e_no_exist", "camelCase")).toBe(input.camelCase);
    });
});
