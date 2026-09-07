/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, beforeAll } from "vitest";
import { waitFor } from "@testing-library/dom";
import fetchMock from "@fetch-mock/vitest";

vi.mock("../getconfig.ts", () => ({
    getVectorConfig: vi.fn().mockResolvedValue({ default_server_name: "server_name" }),
}));
vi.mock("./mobile-apps.ts");

describe("onBackToElementClick", () => {
    beforeAll(async () => {
        const backButton = document.createElement("a");
        backButton.id = "back_to_element_button";
        backButton.textContent = "Back";
        document.body.append(backButton);

        fetchMock.get("https://server_name/.well-known/matrix/client", {
            "m.homeserver": {
                base_url: "https://server/",
            },
        });
        await import("./index.ts");
    });

    beforeEach(async () => {
        sessionStorage.clear();
    });

    it("should set skip_mobile_redirect in sessionStorage", async () => {
        expect(sessionStorage.getItem("skip_mobile_redirect")).toBeFalsy();
        const button = document.getElementById("back_to_element_button")!;
        await waitFor(() => expect(button.onclick).toBeTruthy());
        button.click();
        expect(sessionStorage.getItem("skip_mobile_redirect")).toBe("true");
    });
});
