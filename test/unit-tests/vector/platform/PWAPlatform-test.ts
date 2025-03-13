/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";

import PWAPlatform from "../../../../src/vector/platform/PWAPlatform";
import WebPlatform from "../../../../src/vector/platform/WebPlatform";

jest.mock("../../../../src/vector/platform/WebPlatform");

describe("PWAPlatform", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("setNotificationCount", () => {
        it("should call Navigator::setAppBadge", () => {
            navigator.setAppBadge = jest.fn().mockResolvedValue(undefined);
            const platform = new PWAPlatform();
            expect(navigator.setAppBadge).not.toHaveBeenCalled();
            platform.setNotificationCount(123);
            expect(navigator.setAppBadge).toHaveBeenCalledWith(123);
        });

        it("should no-op if the badge count isn't changing", () => {
            navigator.setAppBadge = jest.fn().mockResolvedValue(undefined);
            const platform = new PWAPlatform();
            platform.setNotificationCount(123);
            expect(navigator.setAppBadge).toHaveBeenCalledTimes(1);
            platform.setNotificationCount(123);
            expect(navigator.setAppBadge).toHaveBeenCalledTimes(1);
        });

        it("should fall back to WebPlatform::setNotificationCount if no Navigator::setAppBadge", () => {
            // @ts-ignore
            navigator.setAppBadge = undefined;
            const platform = new PWAPlatform();
            const superMethod = mocked(WebPlatform.prototype.setNotificationCount);
            expect(superMethod).not.toHaveBeenCalled();
            platform.setNotificationCount(123);
            expect(superMethod).toHaveBeenCalledWith(123);
        });

        it("should handle Navigator::setAppBadge rejecting gracefully", () => {
            navigator.setAppBadge = jest.fn().mockRejectedValue(new Error());
            const platform = new PWAPlatform();
            expect(() => platform.setNotificationCount(123)).not.toThrow();
        });
    });
});
