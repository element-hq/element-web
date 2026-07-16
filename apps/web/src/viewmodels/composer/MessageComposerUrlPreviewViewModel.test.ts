/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { vi, describe, it, expect, type Mock, beforeAll, afterAll } from "vitest";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { MessageComposerUrlPreviewViewModel } from "./MessageComposerUrlPreviewViewModel";
import { type MessageComposerUrlPreviewSnapshotEntry } from "@element-hq/web-shared-components";
import { sleep } from "matrix-js-sdk/src/utils";

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
    const vm = new MessageComposerUrlPreviewViewModel({
        client,
        visible,
        showTooltips: false,
        urlPreviewBundle: false,
    });
    return { vm, client: client as unknown as { getUrlPreview: Mock; mxcUrlToHttp: Mock } };
}

function getEntrySummary({ matched_url, include, status }: MessageComposerUrlPreviewSnapshotEntry): {
    matched_url: string;
    status: "loading" | "loaded" | "failed";
    include: boolean;
} {
    return { matched_url, include, status };
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
            "content": "",
            "entries": [],
          }
        `);
    });

    it("should preview a valid URL in text", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
        vm.updateWithText({ content: "Check out https://example.org today", debounced: false });
        await sleep(100); // wait for update to complete
        expect(vm.getSnapshot()).toMatchSnapshot();
    });

    it("should return empty list when preview is not visible", async () => {
        const { vm, client } = getViewModel({ visible: false });
        vm.updateWithText({ content: "https://example.org", debounced: false });
        await sleep(100); // wait for update to complete
        expect(vm.getSnapshot().entries).toHaveLength(0);
        expect(client.getUrlPreview).not.toHaveBeenCalled();
    });

    it("should return list of failed previews when all URL fetches fail", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockRejectedValue(new Error("Forced test failure"));
        vm.updateWithText({ content: "https://example.org", debounced: false });
        await sleep(100); // wait for update to complete
        expect(vm.getSnapshot().entries.map(getEntrySummary)).toEqual([
            { matched_url: "https://example.org", include: true, status: "failed" },
        ]);
    });

    it("should use all URLs with a valid preview when multiple are given", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview
            .mockRejectedValueOnce(new Error("First URL failed"))
            .mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
        vm.updateWithText({ content: "https://example.org/one https://example.org/two", debounced: false });
        await sleep(100); // wait for update to complete
        expect(vm.getSnapshot().entries.map(getEntrySummary)).toEqual([
            {
                matched_url: "https://example.org/one",
                status: "failed",
                include: true,
            },
            {
                matched_url: "https://example.org/two",
                status: "loaded",
                include: true,
            },
        ]);
    });

    it("should not re-fetch when text changes but the URL set does not", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        vm.updateWithText({ content: "https://example.org", debounced: false });
        vm.updateWithText({ content: "https://example.org some extra words", debounced: false });
        await sleep(100); // wait for update to complete
        expect(client.getUrlPreview).toHaveBeenCalledTimes(1);
    });

    it("should deduplicate repeated URLs", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        vm.updateWithText({
            content: "https://example.org https://example.org https://example.org",
            debounced: false,
        });
        await sleep(100); // wait for update to complete
        expect(client.getUrlPreview).toHaveBeenCalledTimes(1);
    });

    it("should hide preview when made invisible", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        vm.updateWithText({ content: "https://example.org", debounced: false });
        await sleep(100); // wait for update to complete
        expect(vm.getSnapshot().entries).not.toHaveLength(0);
        vm.updateUrlPreviewVisible(false);
        await sleep(100); // wait for update to complete
        expect(vm.getSnapshot().entries).toHaveLength(0);
    });

    it("should restore preview when made visible again", async () => {
        const { vm, client } = getViewModel({ visible: false });
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        vm.updateWithText({ content: "https://example.org", debounced: false });
        await sleep(100); // wait for update to complete
        expect(vm.getSnapshot().entries).toHaveLength(0);
        vm.updateUrlPreviewVisible(true);
        await sleep(100); // wait for update to complete
        expect(vm.getSnapshot().entries).not.toHaveLength(0);
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
        vm.updateWithText({ content: "https://example.org", debounced: false });
        await sleep(100); // wait for update to complete
        expect(vm.getSnapshot()).toMatchSnapshot();
    });
});
