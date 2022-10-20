/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { mocked } from "jest-mock";

import PWAPlatform from "../../../../src/vector/platform/PWAPlatform";
import WebPlatform from "../../../../src/vector/platform/WebPlatform";

jest.mock("../../../../src/vector/platform/WebPlatform");

describe('PWAPlatform', () => {
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
            navigator.setAppBadge = undefined;
            const platform = new PWAPlatform();
            const superMethod = mocked(WebPlatform.prototype.setNotificationCount);
            expect(superMethod).not.toHaveBeenCalled();
            platform.setNotificationCount(123);
            expect(superMethod).toHaveBeenCalledWith(123);
        });

        it("should handle Navigator::setAppBadge rejecting gracefully", () => {
            navigator.setAppBadge = jest.fn().mockRejectedValue(new Error);
            const platform = new PWAPlatform();
            expect(() => platform.setNotificationCount(123)).not.toThrow();
        });
    });
});
