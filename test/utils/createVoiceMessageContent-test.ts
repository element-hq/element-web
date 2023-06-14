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

import { IEncryptedFile } from "matrix-js-sdk/src/matrix";

import { createVoiceMessageContent } from "../../src/utils/createVoiceMessageContent";

describe("createVoiceMessageContent", () => {
    it("should create a voice message content", () => {
        expect(
            createVoiceMessageContent(
                "mxc://example.com/file",
                "ogg/opus",
                23000,
                42000,
                {} as unknown as IEncryptedFile,
                [1, 2, 3],
            ),
        ).toMatchSnapshot();
    });
});
