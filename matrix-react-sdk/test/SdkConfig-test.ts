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

import SdkConfig, { DEFAULTS } from "../src/SdkConfig";

describe("SdkConfig", () => {
    describe("with default values", () => {
        it("should return the default config", () => {
            expect(SdkConfig.get()).toEqual(DEFAULTS);
        });
    });

    describe("with custom values", () => {
        beforeEach(() => {
            SdkConfig.put({
                voice_broadcast: {
                    chunk_length: 42,
                    max_length: 1337,
                },
                feedback: {
                    existing_issues_url: "https://existing",
                } as any,
            });
        });

        it("should return the custom config", () => {
            const customConfig = JSON.parse(JSON.stringify(DEFAULTS));
            customConfig.voice_broadcast.chunk_length = 42;
            customConfig.voice_broadcast.max_length = 1337;
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
