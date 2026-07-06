/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect } from "vitest";

import { onSubmitPreventDefault } from "./form.ts";

describe("onSubmitPreventDefault", () => {
    it("should preventDefault", () => {
        const event = new SubmitEvent("submit");
        const spy = vi.spyOn(event, "preventDefault");

        onSubmitPreventDefault(event);
        expect(spy).toHaveBeenCalled();
    });
});
