/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
import { createTestClient } from "test-utils";

import { singleMxcUpload, splitAtFirstSpace } from "./utils";
import Modal from "../Modal";
import { stripFileMetadata } from "../utils/media/stripFileMetadata";

vi.mock("../utils/media/stripFileMetadata", () => ({
    stripFileMetadata: vi.fn(),
}));

describe("splitAtFirstSpace", () => {
    it("should be able to split arguments at the first whitespace", () => {
        expect(splitAtFirstSpace("a b")).toEqual(["a", "b"]);
        expect(splitAtFirstSpace("arg1 Followed by more stuff")).toEqual(["arg1", "Followed by more stuff"]);
        expect(splitAtFirstSpace("arg1 Followed by more\nstuff")).toEqual(["arg1", "Followed by more\nstuff"]);
        expect(splitAtFirstSpace("  arg1 Followed by more stuff  ")).toEqual(["arg1", "Followed by more stuff"]);
        expect(splitAtFirstSpace("arg1 \t\n Followed by more stuff")).toEqual(["arg1", "Followed by more stuff"]);
        expect(splitAtFirstSpace("a")).toEqual(["a"]);
        expect(splitAtFirstSpace("arg1")).toEqual(["arg1"]);
        expect(splitAtFirstSpace("arg1    ")).toEqual(["arg1"]);
        expect(splitAtFirstSpace("  arg1    ")).toEqual(["arg1"]);
    });
});

describe("singleMxcUpload", () => {
    const file = new File(["original"], "avatar.jpg", { type: "image/jpeg" });
    const strippedFile = new File(["stripped"], "avatar.jpg", { type: "image/jpeg" });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** Picks `file` in the file selector as soon as it is opened, then answers the upload dialog. */
    function pickFile(stripMetadata: boolean): void {
        vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
            Object.defineProperty(this, "files", { value: [file] });
            this.dispatchEvent(new Event("change"));
        });
        vi.spyOn(Modal, "createDialog").mockReturnValue({
            finished: Promise.resolve([true, false, stripMetadata]),
            close: vi.fn(),
        });
        vi.mocked(stripFileMetadata).mockResolvedValue(strippedFile);
    }

    it("removes metadata when chosen in the upload dialog", async () => {
        const client = createTestClient();
        vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/avatar" });
        pickFile(true);

        await expect(singleMxcUpload(client)).resolves.toBe("mxc://server/avatar");
        expect(client.uploadContent).toHaveBeenCalledWith(strippedFile);
    });

    it("uploads the original file when the user chose to keep its metadata", async () => {
        const client = createTestClient();
        vi.mocked(client.uploadContent).mockResolvedValue({ content_uri: "mxc://server/avatar" });
        pickFile(false);

        await expect(singleMxcUpload(client)).resolves.toBe("mxc://server/avatar");
        expect(client.uploadContent).toHaveBeenCalledWith(file);
    });
});
