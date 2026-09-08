/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, vi } from "vitest";

import { DispatcherApi } from "./DispatcherApi";
import type { MatrixDispatcher } from "../dispatcher/dispatcher";

describe("DispatcherApi", () => {
    it("should register the callback with the dispatcher and return its token", () => {
        const mockDispatcher = {
            register: vi.fn().mockReturnValue("token-123"),
            unregister: vi.fn(),
        } as unknown as MatrixDispatcher;
        const api = new DispatcherApi(mockDispatcher);

        const callback = vi.fn();
        const token = api.register(callback);

        expect(mockDispatcher.register).toHaveBeenCalledWith(callback);
        expect(token).toBe("token-123");
    });

    it("should unregister the given token from the dispatcher", () => {
        const mockDispatcher = {
            register: vi.fn(),
            unregister: vi.fn(),
        } as unknown as MatrixDispatcher;
        const api = new DispatcherApi(mockDispatcher);

        api.unregister("token-123");

        expect(mockDispatcher.unregister).toHaveBeenCalledWith("token-123");
    });
});
