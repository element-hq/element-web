/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, vi } from "vitest";

import { SnakedObject, snakeToCamel } from "./SnakedObject";

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
    const input = {
        snake_case: "woot",
        snakeCase: "oh no", // ensure different value from snake_case for tests
        camelCase: "fallback",
    };

    it("should prefer snake_case keys", () => {
        const snake = new SnakedObject(input);

        expect(snake.get("snake_case")).toBe(input.snake_case);
        expect(snake.get("snake_case", "camelCase")).toBe(input.snake_case);
    });

    it("should fall back to camelCase keys when needed", () => {
        const snake = new SnakedObject(input);

        // @ts-ignore - we're deliberately supplying a key that doesn't exist
        expect(snake.get("camel_case")).toBe(input.camelCase);

        // @ts-ignore - we're deliberately supplying a key that doesn't exist
        expect(snake.get("e_no_exist", "camelCase")).toBe(input.camelCase);
    });

    it("should only log camelCase warning once per key", () => {
        // Given we are collecting  all warnings
        SnakedObject.resetFallbackWarnings();
        let warn = vi.spyOn(console, "warn");
        warn.mockClear();

        // When we ask for the same camelCase key twice
        const snake = new SnakedObject(input);

        // @ts-ignore - intentionally different case
        expect(snake.get("camel_case")).toBe(input.camelCase);

        // @ts-ignore - intentionally different case
        expect(snake.get("camel_case")).toBe(input.camelCase);

        // Then we log the warning only once
        expect(warn).toHaveBeenCalledExactlyOnceWith(
            `\
Using deprecated camelCase config camelCase
See https://github.com/vector-im/element-web/blob/develop/docs/config.md#-deprecation-notice`
        );
    });

    it("should only log camelCase warning once per key, even with different instances", () => {
        // Given we are collecting  all warnings
        SnakedObject.resetFallbackWarnings();
        let warn = vi.spyOn(console, "warn");
        warn.mockClear();

        // When we ask for the same camelCase key twice, from two different
        // instances of SnakedObject

        const snake1 = new SnakedObject(input);
        // @ts-ignore - intentionally different case
        expect(snake1.get("camel_case")).toBe(input.camelCase);

        const snake2 = new SnakedObject(input);
        // @ts-ignore - intentionally different case
        expect(snake2.get("camel_case")).toBe(input.camelCase);

        // Then we log the warning only once
        expect(warn).toHaveBeenCalledOnce();
    });
});
