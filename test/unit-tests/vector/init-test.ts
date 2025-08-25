/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://app.element.io/?loginToken=123&state=abc&code=xyz&no_universal_links&something_else=value"}
 */

/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "fetch-mock-jest";
import { waitFor, screen } from "jest-matrix-react";

import { loadApp, showError, showIncompatibleBrowser } from "../../../src/vector/init.tsx";
import SdkConfig from "../../../src/SdkConfig.ts";
import MatrixChat from "../../../src/components/structures/MatrixChat.tsx";

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
        await screen.findByText("Element does not support this browser");
        expect(document.getElementById("matrixchat")).toMatchSnapshot();
    });
});

describe("showError", () => {
    beforeEach(setUpMatrixChatDiv);

    it("should match snapshot", async () => {
        await showError("Error title", ["msg1", "msg2"]);
        await screen.findByText("Error title");
        expect(document.getElementById("matrixchat")).toMatchSnapshot();
    });
});

describe("loadApp", () => {
    beforeEach(setUpMatrixChatDiv);

    beforeEach(async () => {
        fetchMock.get("https://matrix.org/_matrix/client/versions", { versions: ["v1.6"] });
        SdkConfig.put({ default_server_config: { "m.homeserver": { base_url: "https://matrix.org" } } });
    });

    it("should set window.matrixChat to the MatrixChat instance", async () => {
        await loadApp({});
        await waitFor(() => expect(window.matrixChat).toBeInstanceOf(MatrixChat));
    });

    it("should pass onTokenLoginCompleted which strips searchParams to MatrixChat", async () => {
        const spy = jest.spyOn(window.history, "replaceState");

        await loadApp({});
        await waitFor(() => expect(window.matrixChat).toBeInstanceOf(MatrixChat));
        window.matrixChat!.props.onTokenLoginCompleted();

        expect(spy).toHaveBeenCalledWith(
            null,
            "",
            expect.stringContaining("https://app.element.io/?something_else=value"),
        );
    });
});
