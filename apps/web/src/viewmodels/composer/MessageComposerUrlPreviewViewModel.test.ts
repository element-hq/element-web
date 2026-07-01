/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { vi, describe, it, expect, type Mock, beforeAll, afterAll } from "vitest";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { MessageComposerUrlPreviewViewModel } from "./MessageComposerUrlPreviewViewModel";

const IMAGE_MXC = "mxc://example.org/abc";
const BASIC_PREVIEW_OGDATA = {
    "og:title": "This is an example!",
    "og:description": "This is a description",
    "og:type": "document",
    "og:url": "https://example.org",
    "og:site_name": "Example.org",
};

function getViewModel({ visible } = { visible: true }): {
    vm: MessageComposerUrlPreviewViewModel;
    client: { getUrlPreview: Mock; mxcUrlToHttp: Mock };
} {
    const client = {
        getUrlPreview: vi.fn(),
        mxcUrlToHttp: vi.fn(),
    } as unknown as MatrixClient;
    const vm = new MessageComposerUrlPreviewViewModel({ client, visible, showTooltips: false });
    return { vm, client: client as unknown as { getUrlPreview: Mock; mxcUrlToHttp: Mock } };
}
describe("MessageComposerUrlPreviewViewModel", () => {
    let originalDevicePixelRatio: Window["devicePixelRatio"];
    beforeAll(() => {
        originalDevicePixelRatio = window.devicePixelRatio;
        window.devicePixelRatio = 1;
    });
    afterAll(() => {
        window.devicePixelRatio = originalDevicePixelRatio;
    });

    it("should return no preview by default", () => {
        expect(getViewModel().vm.getSnapshot()).toMatchInlineSnapshot(`
{
  "preview": null,
}
`);
    });

    it("should preview a valid URL in text", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
        await vm.updateWithText("Check out https://example.org today");
        expect(vm.getSnapshot()).toMatchSnapshot();
    });

    it("should return null when preview is not visible", async () => {
        const { vm, client } = getViewModel({ visible: false });
        await vm.updateWithText("https://example.org");
        expect(vm.getSnapshot().preview).toBeNull();
        expect(client.getUrlPreview).not.toHaveBeenCalled();
    });

    it("should return null when all URL fetches fail", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockRejectedValue(new Error("Forced test failure"));
        await vm.updateWithText("https://example.org");
        expect(vm.getSnapshot().preview).toBeNull();
    });

    it("should use the first URL with a valid preview when multiple are given", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview
            .mockRejectedValueOnce(new Error("First URL failed"))
            .mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
        await vm.updateWithText("https://example.org/one https://example.org/two");
        expect(vm.getSnapshot().preview?.link).toEqual("https://example.org/two");
    });

    it("should not re-fetch when text changes but the URL set does not", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        await vm.updateWithText("https://example.org");
        await vm.updateWithText("https://example.org some extra words");
        expect(client.getUrlPreview).toHaveBeenCalledTimes(1);
    });

    it("should deduplicate repeated URLs", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        await vm.updateWithText("https://example.org https://example.org https://example.org");
        expect(client.getUrlPreview).toHaveBeenCalledTimes(1);
    });

    it("should hide preview when made invisible", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        await vm.updateWithText("https://example.org");
        expect(vm.getSnapshot().preview).not.toBeNull();
        await vm.updateUrlPreviewVisible(false);
        expect(vm.getSnapshot().preview).toBeNull();
    });

    it("should restore preview when made visible again", async () => {
        const { vm, client } = getViewModel({ visible: false });
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        await vm.updateWithText("https://example.org");
        expect(vm.getSnapshot().preview).toBeNull();
        await vm.updateUrlPreviewVisible(true);
        expect(vm.getSnapshot().preview).not.toBeNull();
    });

    it("should preview a URL with media", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValueOnce({
            "og:title": "Media example",
            "og:type": "document",
            "og:url": "https://example.org",
            "og:image": IMAGE_MXC,
            "og:image:height": 128,
            "og:image:width": 128,
            "matrix:image:size": 10000,
        });
        // eslint-disable-next-line no-restricted-properties
        client.mxcUrlToHttp.mockImplementation((url, width) => {
            expect(url).toEqual(IMAGE_MXC);
            if (width) return "https://example.org/image/thumb";
            return "https://example.org/image/src";
        });
        await vm.updateWithText("https://example.org");
        expect(vm.getSnapshot()).toMatchSnapshot();
    });
});
