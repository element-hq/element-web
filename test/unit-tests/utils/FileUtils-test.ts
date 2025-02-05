/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MediaEventContent } from "matrix-js-sdk/src/types";

import { downloadLabelForFile } from "../../../src/utils/FileUtils.ts";

describe("FileUtils", () => {
    describe("downloadLabelForFile", () => {
        it.each([
            [
                "File with size",
                {
                    input: {
                        msgtype: "m.file",
                        body: "Test",
                        info: {
                            size: 102434566,
                        },
                    } as MediaEventContent,
                    output: "Download (97.69 MB)",
                },
            ],
            [
                "Image",
                {
                    input: {
                        msgtype: "m.image",
                        body: "Test",
                    } as MediaEventContent,
                    output: "Download",
                },
            ],
            [
                "Video",
                {
                    input: {
                        msgtype: "m.video",
                        body: "Test",
                    } as MediaEventContent,
                    output: "Download",
                },
            ],
            [
                "Audio",
                {
                    input: {
                        msgtype: "m.audio",
                        body: "Test",
                    } as MediaEventContent,
                    output: "Download",
                },
            ],
        ])("should correctly label %s", (_d, { input, output }) => expect(downloadLabelForFile(input)).toBe(output));
    });
});
