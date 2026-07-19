/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { expect } from "@jest/globals";

import type { MockedObject } from "jest-mock-vitest-adapter";
import { MsgType, type MatrixClient } from "matrix-js-sdk/src/matrix";
import {
    BUNDLED_LINK_PREVIEWS,
    MAX_PREVIEWS_WHEN_LIMITED,
    UrlPreviewGroupViewModel,
} from "../../../src/viewmodels/message-body/UrlPreviewGroupViewModel";
import type { UrlPreview } from "@element-hq/web-shared-components";
import { getMockClientWithEventEmitter, mkEvent } from "../../test-utils";

const IMAGE_MXC = "mxc://example.org/abc";
const BASIC_PREVIEW_OGDATA = {
    "og:title": "This is an example!",
    "og:description": "This is a description",
    "og:type": "document",
    "og:url": "https://example.org",
    "og:site_name": "Example.org",
};

const BUNDLE_PREVIEW_ONE = {
    "matched_url": "https://example.org/1",
    "og:title": "Bundled one",
    "og:description": "First bundled preview",
    "og:url": "https://example.org/1",
};
const BUNDLE_PREVIEW_TWO = {
    "matched_url": "https://example.org/2",
    "og:title": "Bundled two",
    "og:description": "Second bundled preview",
    "og:url": "https://example.org/2",
};
const BUNDLE_PREVIEW_THREE = {
    "matched_url": "https://example.org/3",
    "og:title": "Bundled three",
    "og:description": "Third bundled preview",
    "og:url": "https://example.org/3",
};
const BUNDLE_PREVIEW_WITH_IMAGE = {
    "matched_url": "https://example.org/image",
    "og:title": "Bundled with image",
    "og:image": IMAGE_MXC,
    "og:image:type": "image/png",
    "og:image:width": 128,
    "og:image:height": 128,
};

function getViewModel({
    mediaVisible = true,
    visible = true,
    showPreview = true,
    urlPreviewBundleEnabled = true,
    content,
}: {
    mediaVisible?: boolean;
    visible?: boolean;
    showPreview?: boolean;
    urlPreviewBundleEnabled?: boolean;
    content?: object;
} = {}): {
    vm: UrlPreviewGroupViewModel;
    client: MockedObject<MatrixClient>;
    onImageClicked: jest.Mock<void, [UrlPreview]>;
} {
    const client = getMockClientWithEventEmitter({
        getUrlPreview: jest.fn(),
        mxcUrlToHttp: jest.fn(),
    });
    const onImageClicked = jest.fn<void, [UrlPreview]>();
    const vm = new UrlPreviewGroupViewModel({
        client,
        mediaVisible,
        visible,
        onImageClicked,
        showTooltips: false,
        mxEvent: mkEvent({
            event: true,
            user: "@foo:bar",
            type: "m.room.message",
            content: {
                ...(showPreview ? undefined : { [BUNDLED_LINK_PREVIEWS]: [] }),
                ...content,
            },
            id: "$id",
        }),
        urlPreviewBundleEnabled,
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
            { link: "https://example.org/1" },
            { link: "https://example.org/2" },
            { link: "https://example.org/3" },
        ]);
    });
    it("should hide preview when invisible", async () => {
        const { vm, client } = getViewModel({
            visible: false,
            mediaVisible: true,
            showPreview: true,
            urlPreviewBundleEnabled: false,
        });
        const msg = document.createElement("div");
        msg.innerHTML = '<a href="https://example.org">Test</a>';
        await vm.updateEventElement(msg);
        expect(vm.getSnapshot()).toMatchSnapshot();
        expect(client.getUrlPreview).not.toHaveBeenCalled();
    });
    it("should ignore media when mediaVisible is false", async () => {
        const { vm, client } = getViewModel({
            mediaVisible: false,
            visible: true,
            showPreview: true,
            urlPreviewBundleEnabled: false,
        });
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
    it("should hide a preview if the message requests it", async () => {
        const { vm, client } = getViewModel({
            showPreview: false,
            mediaVisible: true,
            visible: true,
            urlPreviewBundleEnabled: false,
        });
        client.getUrlPreview.mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
        const msg = document.createElement("div");
        msg.innerHTML = '<a href="https://example.org">Test</a>';
        await vm.updateEventElement(msg);
        expect(vm.getSnapshot()).toMatchInlineSnapshot(`
{
  "overPreviewLimit": false,
  "previews": [],
  "previewsLimited": false,
  "totalPreviewCount": 0,
}
`);
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

    describe("bundled link previews (MSC4095)", () => {
        it("should render bundled previews when the message is text and the bundle is enabled", async () => {
            const { vm, client } = getViewModel({
                urlPreviewBundleEnabled: true,
                content: {
                    msgtype: MsgType.Text,
                    [BUNDLED_LINK_PREVIEWS]: [BUNDLE_PREVIEW_ONE, BUNDLE_PREVIEW_TWO],
                },
            });
            const msg = document.createElement("div");
            msg.innerHTML = '<a href="https://example.org/1">Test1</a><a href="https://example.org/2">Test2</a>';
            await vm.updateEventElement(msg);
            const { previews } = vm.getSnapshot();
            expect(previews).toMatchObject([
                {
                    link: "https://example.org/1",
                    title: "Bundled one",
                    description: "First bundled preview",
                    siteName: "example.org",
                    ogUrl: "https://example.org/1",
                },
                {
                    link: "https://example.org/2",
                    title: "Bundled two",
                    description: "Second bundled preview",
                    siteName: "example.org",
                    ogUrl: "https://example.org/2",
                },
            ]);
            // Bundled previews are provided inline and must not trigger network fetches.
            expect(client.getUrlPreview).not.toHaveBeenCalled();
        });

        it("should render an image for a bundled preview", async () => {
            const { vm, client } = getViewModel({
                urlPreviewBundleEnabled: true,
                content: {
                    msgtype: MsgType.Text,
                    [BUNDLED_LINK_PREVIEWS]: [BUNDLE_PREVIEW_WITH_IMAGE],
                },
            });
            // eslint-disable-next-line no-restricted-properties
            client.mxcUrlToHttp.mockReturnValue("https://example.org/image/src");
            const msg = document.createElement("div");
            msg.innerHTML = '<a href="https://example.org/image">Test</a>';
            await vm.updateEventElement(msg);
            const { previews } = vm.getSnapshot();
            expect(previews).toHaveLength(1);
            expect(previews[0].image).toMatchObject({
                mxcImageFull: IMAGE_MXC,
                imageType: "image/png",
                width: 128,
                height: 128,
            });
            expect(client.getUrlPreview).not.toHaveBeenCalled();
        });

        it("should limit bundled previews and reveal the rest when the limit is toggled", async () => {
            const { vm, client } = getViewModel({
                urlPreviewBundleEnabled: true,
                content: {
                    msgtype: MsgType.Text,
                    [BUNDLED_LINK_PREVIEWS]: [BUNDLE_PREVIEW_ONE, BUNDLE_PREVIEW_TWO, BUNDLE_PREVIEW_THREE],
                },
            });
            const msg = document.createElement("div");
            msg.innerHTML =
                '<a href="https://example.org/1">Test1</a><a href="https://example.org/2">Test2</a><a href="https://example.org/3">Test3</a>';
            await vm.updateEventElement(msg);

            let snapshot = vm.getSnapshot();
            expect(snapshot.previews).toHaveLength(MAX_PREVIEWS_WHEN_LIMITED);
            expect(snapshot.previewsLimited).toBe(true);
            expect(snapshot.overPreviewLimit).toBe(true);

            await vm.onTogglePreviewLimit();
            snapshot = vm.getSnapshot();
            expect(snapshot.previews).toHaveLength(3);
            expect(snapshot.previewsLimited).toBe(false);
            expect(client.getUrlPreview).not.toHaveBeenCalled();
        });

        it("should fetch previews instead of using the bundle when the bundle setting is disabled", async () => {
            const { vm, client } = getViewModel({
                urlPreviewBundleEnabled: false,
                content: {
                    msgtype: MsgType.Text,
                    [BUNDLED_LINK_PREVIEWS]: [BUNDLE_PREVIEW_ONE],
                },
            });
            client.getUrlPreview.mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
            const msg = document.createElement("div");
            msg.innerHTML = '<a href="https://example.org/1">Test1</a>';
            await vm.updateEventElement(msg);
            const { previews } = vm.getSnapshot();
            expect(client.getUrlPreview).toHaveBeenCalledWith("https://example.org/1", expect.anything());
            // The fetched preview wins over the ignored bundle entry.
            expect(previews).toMatchObject([{ title: "This is an example!" }]);
        });

        it("should fetch previews instead of using the bundle when the message is not a text message", async () => {
            const { vm, client } = getViewModel({
                urlPreviewBundleEnabled: true,
                content: {
                    msgtype: MsgType.Notice,
                    [BUNDLED_LINK_PREVIEWS]: [BUNDLE_PREVIEW_ONE],
                },
            });
            client.getUrlPreview.mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
            const msg = document.createElement("div");
            msg.innerHTML = '<a href="https://example.org/1">Test1</a>';
            await vm.updateEventElement(msg);
            const { previews } = vm.getSnapshot();
            expect(client.getUrlPreview).toHaveBeenCalledWith("https://example.org/1", expect.anything());
            expect(previews).toMatchObject([{ title: "This is an example!" }]);
        });
    });
});
