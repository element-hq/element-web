/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { expect } from "@jest/globals";

import type { MockedObject } from "jest-mock";
import type { MatrixClient, IPreviewUrlResponse } from "matrix-js-sdk/src/matrix";
import { UrlPreviewGroupViewModel } from "../../../src/viewmodels/message-body/UrlPreviewGroupViewModel";
import type { UrlPreviewGroupViewPreview } from "@element-hq/web-shared-components";
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
    vm: UrlPreviewGroupViewModel;
    client: MockedObject<MatrixClient>;
    onImageClicked: jest.Mock<void, [UrlPreviewGroupViewPreview]>;
} {
    const client = getMockClientWithEventEmitter({
        getUrlPreview: jest.fn(),
        mxcUrlToHttp: jest.fn(),
    });
    const onImageClicked = jest.fn<void, [UrlPreviewGroupViewPreview]>();
    const vm = new UrlPreviewGroupViewModel({
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

describe("UrlPreviewGroupViewModel", () => {
    it("should return no previews by default", () => {
        expect(getViewModel().vm.getSnapshot()).toMatchSnapshot();
    });
    it("should preview a single valid URL", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
        const msg = document.createElement("div");
        msg.innerHTML = '<a href="https://example.org">Test</a>';
        await vm.updateEventElement(msg);
        expect(vm.getSnapshot()).toMatchSnapshot();
    });
    it("should preview nested URLs but ignore some element types", async () => {
        const { vm, client } = getViewModel();
        vm.onTogglePreviewLimit();
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        const msg = document.createElement("div");
        msg.innerHTML = `
    <ul>
        <a href="https://example.org/1">Test1</a>
        <li><a href="https://example.org/2">Test2</a></li>
        <li>
            <ol>
                <li><a href="https://example.org/3">Test3</a></li>
            </ol>
        </li>
    </ul>
    <pre><a href="https://example.org">Test4</a></pre>
    <code><a href="https://example.org">Test5</a></code>
    <blockquote><a href="https://example.org">Test6</a></blockquote>`;
        await vm.updateEventElement(msg);
        const { previews } = vm.getSnapshot();
        expect(previews).toHaveLength(3);
        expect(previews).toMatchObject([
            {
                link: "https://example.org/1",
            },
            {
                link: "https://example.org/2",
            },
            {
                link: "https://example.org/3",
            },
        ]);
    });
    it("should hide preview when invisible", async () => {
        const { vm, client } = getViewModel({ visible: false, mediaVisible: true });
        const msg = document.createElement("div");
        msg.innerHTML = '<a href="https://example.org">Test</a>';
        await vm.updateEventElement(msg);
        expect(vm.getSnapshot()).toMatchSnapshot();
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
        expect(vm.getSnapshot()).toMatchSnapshot();
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
        expect(vm.getSnapshot()).toMatchSnapshot();
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
        expect(vm.getSnapshot()).toMatchSnapshot();
        expect(client.getUrlPreview).toHaveBeenCalledTimes(1);
    });
    it("should ignore failed previews", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockRejectedValue(new Error("Forced test failure"));
        const msg = document.createElement("div");
        msg.innerHTML = '<a href="https://example.org">Test</a>';
        await vm.updateEventElement(msg);
        expect(vm.getSnapshot()).toMatchSnapshot();
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
        expect(vm.getSnapshot()).toMatchSnapshot();

        await vm.onShowClick();
        expect(vm.getSnapshot()).toMatchSnapshot();
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

    // og:url, og:type are ignored.
    const baseOg = {
        "og:url": "https://example.org",
        "og:type": "document",
    };

    it.each<IPreviewUrlResponse>([
        { ...baseOg, "og:title": "Basic title" },
        { ...baseOg, "og:site_name": "Site name", "og:title": "" },
        { ...baseOg, "og:description": "A description", "og:title": "" },
        { ...baseOg, "og:title": "Cool blog", "og:site_name": "Cool site" },
        {
            ...baseOg,
            "og:title": "Media test",
            // API *may* return a string, so check we parse correctly.
            "og:image:height": "500" as unknown as number,
            "og:image:width": 500,
            "matrix:image:size": 1024,
            "og:image": IMAGE_MXC,
        },
    ])("handles different kinds of opengraph responses %s", async (og) => {
        const { vm, client } = getViewModel();
        // eslint-disable-next-line no-restricted-properties
        client.mxcUrlToHttp.mockImplementation((url, width) => {
            expect(url).toEqual(IMAGE_MXC);
            if (width) {
                return "https://example.org/image/thumb";
            }
            return "https://example.org/image/src";
        });
        client.getUrlPreview.mockResolvedValueOnce(og);
        const msg = document.createElement("div");
        msg.innerHTML = `<a href="https://example.org">test</a>`;
        await vm.updateEventElement(msg);
        expect(vm.getSnapshot().previews[0]).toMatchSnapshot();
    });
});
