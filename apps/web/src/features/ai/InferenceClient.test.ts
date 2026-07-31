/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { cleanOcrText } from "./InferenceClient";

describe("cleanOcrText", () => {
    it("removes Markdown, HTML and layout metadata without changing recognised text", () => {
        expect(
            cleanOcrText(
                "```text\n# 标题\n<div>第一行</div>\n![](page=0,bbox=[1, 2, 3, 4])\nbbox=[0,0,1,1]\n第二行\n```",
            ),
        ).toBe("标题\n第一行\n第二行");
    });

    it("retains ordinary punctuation and collapses only excess blank lines", () => {
        expect(cleanOcrText("经文（约 3:16）  \n\n\n平安！")).toBe("经文（约 3:16）\n\n平安！");
    });
});
