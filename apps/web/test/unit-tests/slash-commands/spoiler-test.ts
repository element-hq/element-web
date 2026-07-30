/*
 * Copyright 2026 hayaksi1
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type IContent } from "matrix-js-sdk/src/matrix";

import { setUpCommandTest } from "./utils";

describe("/spoiler", () => {
    const roomId = "!room:example.com";

    const runSpoiler = async (input: string): Promise<IContent> => {
        const { client, command, args } = setUpCommandTest(roomId, `/spoiler ${input}`);
        const content = await command.run(client, roomId, null, args).promise;
        expect(content).toBeDefined();
        return content!;
    };

    it("should wrap the message in a spoiler span", async () => {
        const content = await runSpoiler("this is a test message");

        expect(content.body).toBe("this is a test message");
        expect(content.format).toBe("org.matrix.custom.html");
        expect(content.formatted_body).toMatchSnapshot();
    });

    it("should convert Markdown in the spoiler", async () => {
        const content = await runSpoiler("some **bold** and some _italic_");

        expect(content.body).toBe("some **bold** and some _italic_");
        expect(content.formatted_body).toContain("<strong>bold</strong>");
        expect(content.formatted_body).toContain("<em>italic</em>");
    });

    it("should escape HTML in the spoiler", async () => {
        const content = await runSpoiler("<b>not bold</b>");

        expect(content.body).toBe("<b>not bold</b>");
        expect(content.formatted_body).not.toContain("<b>");
        expect(content.formatted_body).toContain("&lt;b&gt;");
    });

    it("should preserve line breaks in a multi-line spoiler", async () => {
        const content = await runSpoiler("first line\nsecond line");

        expect(content.body).toBe("first line\nsecond line");
        expect(content.formatted_body).toContain("<br>");
    });
});
