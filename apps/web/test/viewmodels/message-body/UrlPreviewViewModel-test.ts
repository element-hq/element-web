/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { expect } from "@jest/globals";

import type { MockedObject } from "jest-mock";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { UrlPreviewViewModel } from "../../../src/viewmodels/message-body/UrlPreviewViewModel";
import type { UrlPreviewViewSnapshotPreview } from "@element-hq/web-shared-components";
import { getMockClientWithEventEmitter, mkEvent } from "../../test-utils";

const IMAGE_MXC = "mxc://example.org/abc";
const BASIC_PREVIEW_OGDATA = {
    "og:title": "This is an example!",
    "og:description": "This is a description",
    "og:type": "document",
    "og:url": "https://example.org",
    "og:site_name": "Example.org",
};

function getViewModel({ mediaVisible, visible } = { mediaVisible: true, visible: true }): {
    vm: UrlPreviewViewModel;
    client: MockedObject<MatrixClient>;
    onImageClicked: jest.Mock<void, [UrlPreviewViewSnapshotPreview]>;
} {
    const client = getMockClientWithEventEmitter({
        getUrlPreview: jest.fn(),
        mxcUrlToHttp: jest.fn(),
    });
    const onImageClicked = jest.fn<void, [UrlPreviewViewSnapshotPreview]>();
    const vm = new UrlPreviewViewModel({
        client,
        mediaVisible,
        visible,
        onImageClicked,
        mxEvent: mkEvent({
            event: true,
            user: "@foo:bar",
            type: "m.room.message",
            content: {},
            id: "$id",
        }),
    });
    return { vm, client, onImageClicked };
}

describe("UrlPreviewViewModel", () => {
    it("should return no previews by default", () => {
        expect(getViewModel().vm.getSnapshot()).toEqual({
            compactLayout: false,
            overPreviewLimit: false,
            previews: [],
            previewsLimited: true,
            totalPreviewCount: 0,
        });
    });
    it("should preview a single valid URL", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
        const msg = document.createElement("div");
        msg.innerHTML = '<a href="https://example.org">Test</a>';
        await vm.updateEventElement(msg);
        expect(vm.getSnapshot()).toEqual({
            previews: [
                {
                    link: "https://example.org",
                    title: "This is an example!",
                    siteName: "Example.org",
                    showTooltipOnLink: undefined,
                    description: "This is a description",
                    image: undefined,
                },
            ],
            compactLayout: false,
            overPreviewLimit: false,
            previewsLimited: true,
            totalPreviewCount: 1,
        });
    });
    it("should hide preview when invisible", async () => {
        const { vm, client } = getViewModel({ visible: false, mediaVisible: true });
        const msg = document.createElement("div");
        msg.innerHTML = '<a href="https://example.org">Test</a>';
        await vm.updateEventElement(msg);
        expect(vm.getSnapshot()).toEqual({
            previews: [],
            compactLayout: false,
            overPreviewLimit: false,
            previewsLimited: true,
            totalPreviewCount: 1,
        });
        expect(client.getUrlPreview).not.toHaveBeenCalled();
    });
    it("should preview a URL with media", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValueOnce({
            "og:title": "This is an example!",
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
            if (width) {
                return "https://example.org/image/thumb";
            }
            return "https://example.org/image/src";
        });
        const msg = document.createElement("div");
        msg.innerHTML = '<a href="https://example.org">Test</a>';
        await vm.updateEventElement(msg);
        expect(vm.getSnapshot()).toEqual({
            previews: [
                {
                    link: "https://example.org",
                    title: "This is an example!",
                    siteName: undefined,
                    showTooltipOnLink: undefined,
                    description: undefined,
                    image: {
                        height: 100,
                        width: 100,
                        fileSize: 10000,
                        imageThumb: "https://example.org/image/thumb",
                        imageFull: "https://example.org/image/src",
                    },
                },
            ],
            compactLayout: false,
            overPreviewLimit: false,
            previewsLimited: true,
            totalPreviewCount: 1,
        });
    });
    it("should ignore media when mediaVisible is false", async () => {
        const { vm, client } = getViewModel({ mediaVisible: false, visible: true });
        client.getUrlPreview.mockResolvedValueOnce({
            "og:title": "This is an example!",
            "og:type": "document",
            "og:url": "https://example.org",
            "og:image": IMAGE_MXC,
            "og:image:height": 128,
            "og:image:width": 128,
            "matrix:image:size": 10000,
        });
        const msg = document.createElement("div");
        msg.innerHTML = '<a href="https://example.org">Test</a>';
        await vm.updateEventElement(msg);
        expect(vm.getSnapshot()).toEqual({
            previews: [
                {
                    link: "https://example.org",
                    title: "This is an example!",
                    siteName: undefined,
                    showTooltipOnLink: undefined,
                    description: undefined,
                    image: undefined,
                },
            ],
            compactLayout: false,
            overPreviewLimit: false,
            previewsLimited: true,
            totalPreviewCount: 1,
        });
        // eslint-disable-next-line no-restricted-properties
        expect(client.mxcUrlToHttp).not.toHaveBeenCalled();
    });
    it("should deduplicate multiple versions of the same URL", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
        const msg = document.createElement("div");
        msg.innerHTML =
            '<a href="https://example.org">Test</a><a href="https://example.org">Test</a><a href="https://example.org">Test</a>';
        await vm.updateEventElement(msg);
        expect(vm.getSnapshot()).toEqual({
            previews: [
                {
                    link: "https://example.org",
                    title: "This is an example!",
                    siteName: "Example.org",
                    showTooltipOnLink: undefined,
                    description: "This is a description",
                    image: undefined,
                },
            ],
            compactLayout: false,
            overPreviewLimit: false,
            previewsLimited: true,
            totalPreviewCount: 1,
        });
        expect(client.getUrlPreview).toHaveBeenCalledTimes(1);
    });
    it("should ignore failed previews", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockRejectedValue(new Error("Forced test failure"));
        const msg = document.createElement("div");
        msg.innerHTML = '<a href="https://example.org">Test</a>';
        await vm.updateEventElement(msg);
        expect(vm.getSnapshot()).toEqual({
            previews: [],
            compactLayout: false,
            overPreviewLimit: false,
            previewsLimited: true,
            totalPreviewCount: 1,
        });
    });
    it("should handle image clicks", async () => {
        const { vm, client, onImageClicked } = getViewModel();
        client.getUrlPreview.mockResolvedValueOnce({
            "og:title": "This is an example!",
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
            if (width) {
                return "https://example.org/image/thumb";
            }
            return "https://example.org/image/src";
        });
        const msg = document.createElement("div");
        msg.innerHTML = '<a href="https://example.org">Test</a>';
        await vm.updateEventElement(msg);
        const { previews } = vm.getSnapshot();
        vm.onImageClick(previews[0]);
        expect(onImageClicked).toHaveBeenCalled();
    });
    it("should handle being hidden and shown by the user", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
        const msg = document.createElement("div");
        msg.innerHTML = '<a href="https://example.org">Test</a>';
        await vm.updateEventElement(msg);
        await vm.onHideClick();
        expect(vm.getSnapshot()).toEqual({
            previews: [],
            compactLayout: false,
            overPreviewLimit: false,
            previewsLimited: true,
            totalPreviewCount: 1,
        });

        await vm.onShowClick();
        expect(vm.getSnapshot()).toEqual({
            previews: [
                {
                    link: "https://example.org",
                    title: "This is an example!",
                    siteName: "Example.org",
                    showTooltipOnLink: undefined,
                    description: "This is a description",
                    image: undefined,
                },
            ],
            compactLayout: false,
            overPreviewLimit: false,
            previewsLimited: true,
            totalPreviewCount: 1,
        });
    });

    it.each([
        { text: "", href: "", hasPreview: false },
        { text: "test", href: "noprotocol.example.org", hasPreview: false },
        { text: "matrix link", href: "https://matrix.to", hasPreview: false },
        { text: "email", href: "mailto:example.org", hasPreview: false },
        { text: "", href: "https://example.org", hasPreview: true },
    ])("handles different kinds of links %s", async (item) => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
        const msg = document.createElement("div");
        msg.innerHTML = `<a href="${item.href}">${item.text}</a>`;
        await vm.updateEventElement(msg);
        expect(vm.getSnapshot().previews).toHaveLength(item.hasPreview ? 1 : 0);
    });
});
