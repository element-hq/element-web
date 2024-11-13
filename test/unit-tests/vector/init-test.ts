/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { showError, showIncompatibleBrowser } from "../../../src/vector/init.tsx";

function setUpMatrixChatDiv() {
    document.getElementById("matrixchat")?.remove();
    const div = document.createElement("div");
    div.id = "matrixchat";
    document.body.appendChild(div);
}

describe("showIncompatibleBrowser", () => {
    beforeEach(setUpMatrixChatDiv);

    it("should match snapshot", async () => {
        await showIncompatibleBrowser(jest.fn());
        expect(document.getElementById("matrixchat")).toMatchSnapshot();
    });
});

describe("showError", () => {
    beforeEach(setUpMatrixChatDiv);

    it("should match snapshot", async () => {
        await showError("Error title", ["msg1", "msg2"]);
        expect(document.getElementById("matrixchat")).toMatchSnapshot();
    });
});
