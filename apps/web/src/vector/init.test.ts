/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom
// @vitest-environment-options {"url": "https://app.element.io/?loginToken=123&no_universal_links&something_else=value#/home?state=abc&code=xyz"}

import { vi, describe, it, expect, beforeEach } from "vitest";
import fetchMock from "@fetch-mock/vitest";
import { waitFor, screen } from "test-utils-rtl";

import { loadApp, showError, showIncompatibleBrowser } from "./init.tsx";
import SdkConfig from "../SdkConfig.ts";
import MatrixChat from "../components/structures/MatrixChat.tsx";
import { parseAppUrl } from "./url_utils.ts";

function setUpMatrixChatDiv() {
    document.getElementById("matrixchat")?.remove();
    const div = document.createElement("div");
    div.id = "matrixchat";
    document.body.appendChild(div);
}

describe("showIncompatibleBrowser", () => {
    beforeEach(setUpMatrixChatDiv);

    it("should match snapshot", async () => {
        await showIncompatibleBrowser(vi.fn());
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

    it("should replace the previous app rather than leaving it mounted", async () => {
        await loadApp({});
        await waitFor(() => expect(window.matrixChat).toBeInstanceOf(MatrixChat));
        const first = window.matrixChat;

        // Count only what the second load does. We track the mounted/unmounted delta rather than raw
        // mount count, as StrictMode's extra mount/unmount cycle cancels out in the difference.
        const mounted = vi.spyOn(MatrixChat.prototype, "componentDidMount");
        const unmounted = vi.spyOn(MatrixChat.prototype, "componentWillUnmount");
        const delta = (): number => mounted.mock.calls.length - unmounted.mock.calls.length;

        setUpMatrixChatDiv();
        await loadApp({});
        await waitFor(() => expect(window.matrixChat).not.toBe(first));

        // The new app replaces the old one, so the number of live apps is unchanged. A second root over
        // the same container would instead leave the first tree mounted against a detached node, with both
        // copies still driven by the dispatcher and the client peg.
        await waitFor(() => expect(delta()).toBe(0));
    });

    it("should pass onTokenLoginCompleted which strips searchParams & fragment to MatrixChat", async () => {
        const spy = vi.spyOn(window.history, "replaceState");

        await loadApp({});
        await waitFor(() => expect(window.matrixChat).toBeInstanceOf(MatrixChat));
        window.matrixChat!.props.onTokenLoginCompleted(parseAppUrl(window.location).params, "/home");

        expect(spy).toHaveBeenCalledWith(null, "", "https://app.element.io/?something_else=value#/home");
    });
});
