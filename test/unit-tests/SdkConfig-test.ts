/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SdkConfig, { DEFAULTS } from "../../src/SdkConfig";

describe("SdkConfig", () => {
    describe("with default values", () => {
        it("should return the default config", () => {
            expect(SdkConfig.get()).toEqual(DEFAULTS);
        });
    });

    describe("with custom values", () => {
        beforeEach(() => {
            SdkConfig.put({
                feedback: {
                    existing_issues_url: "https://existing",
                } as any,
            });
        });

        it("should return the custom config", () => {
            const customConfig = JSON.parse(JSON.stringify(DEFAULTS));
            customConfig.feedback.existing_issues_url = "https://existing";
            expect(SdkConfig.get()).toEqual(customConfig);
        });

        it("should allow overriding individual fields of sub-objects", () => {
            const feedback = SdkConfig.getObject("feedback");
            expect(feedback.get("existing_issues_url")).toMatchInlineSnapshot(`"https://existing"`);
            expect(feedback.get("new_issue_url")).toMatchInlineSnapshot(
                `"https://github.com/vector-im/element-web/issues/new/choose"`,
            );
        });
    });
});
