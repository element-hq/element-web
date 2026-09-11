/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect, type Mock, beforeAll, afterAll } from "vitest";

import { MatrixEvent, MsgType, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { MessageComposerUrlPreviewViewModel } from "./MessageComposerUrlPreviewViewModel";
import { type MessageComposerUrlPreviewSnapshotEntry } from "@element-hq/web-shared-components";
import { type RoomMessageEventContent } from "../../../@types/url-preview";
import { UrlPreviewApi } from "../../modules/UrlPreviewApi";

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
        moduleUrlPreviewApi: new UrlPreviewApi(),
        urlPreviewBundle: false,
    });
    return { vm, client: client as unknown as { getUrlPreview: Mock; mxcUrlToHttp: Mock } };
}

const BUNDLE_ENTRY_ONE = {
    "matched_url": "https://example.org/one",
    "og:title": "Bundled one",
    "og:description": "First bundled preview",
    "og:url": "https://example.org/one",
};
const BUNDLE_ENTRY_WITH_IMAGE = {
    "matched_url": "https://example.org/image",
    "og:title": "Bundled with image",
    "og:image": IMAGE_MXC,
    "og:image:type": "image/png",
    "og:image:width": 128,
    "og:image:height": 128,
};

type MockClient = { getUrlPreview: Mock; mxcUrlToHttp: Mock };

function getMockClient(): MockClient {
    return {
        getUrlPreview: vi.fn(),
        mxcUrlToHttp: vi.fn(),
    };
}

/**
 * `restoreFromMessage` starts fetching immediately, so `client` must already be set up with the
 * responses the test expects. Pass one built with {@link getMockClient}.
 */
function restoreViewModel(
    content: RoomMessageEventContent,
    { visible = true, urlPreviewBundle = true, client = getMockClient() } = {},
): {
    vm: MessageComposerUrlPreviewViewModel;
    client: MockClient;
} {
    const vm = MessageComposerUrlPreviewViewModel.restoreFromMessage({
        client: client as unknown as MatrixClient,
        moduleUrlPreviewApi: new UrlPreviewApi(),
        visible,
        urlPreviewBundle,
        mxEvent: new MatrixEvent({
            type: "m.room.message",
            content,
            event_id: "$event-id",
            room_id: "!room:example.org",
            sender: "@alice:example.org",
            origin_server_ts: 0,
        }),
    });
    return { vm, client };
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
            "contentLinks": Set {},
            "entries": [],
            "isModified": false,
          }
        `);
    });

    it("should preview a valid URL in text", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
        vm.updateWithText({ content: "Check out https://example.org today", debounced: false });
        await vi.waitFor(() => {
            expect(vm.getSnapshot()).toEqual({
                content: "Check out https://example.org today",
                contentLinks: new Set(["https://example.org"]),
                isModified: true,
                entries: [
                    {
                        include: true,
                        matched_url: "https://example.org",
                        preview: {
                            description: "This is a description",
                            link: "https://example.org",
                            ogUrl: "https://example.org",
                            showTooltipOnLink: false,
                            siteName: "Example.org",
                            title: "This is an example!",
                        },
                        status: "loaded",
                    },
                ],
            });
        });
    });

    it("should return empty list when preview is not visible", async () => {
        const { vm, client } = getViewModel({ visible: false });
        vm.updateWithText({ content: "https://example.org", debounced: false });
        await vi.waitFor(() => {
            expect(vm.getSnapshot().entries).toHaveLength(0);
            expect(client.getUrlPreview).not.toHaveBeenCalled();
        });
    });

    it("should return list of failed previews when all URL fetches fail", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockRejectedValue(new Error("Forced test failure"));
        vm.updateWithText({ content: "https://example.org", debounced: false });
        await vi.waitFor(() => {
            expect(vm.getSnapshot().entries.map(getEntrySummary)).toEqual([
                { matched_url: "https://example.org", include: true, status: "failed" },
            ]);
        });
    });

    it("should use all URLs with a valid preview when multiple are given", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview
            .mockRejectedValueOnce(new Error("First URL failed"))
            .mockResolvedValueOnce(BASIC_PREVIEW_OGDATA);
        vm.updateWithText({ content: "https://example.org/one https://example.org/two", debounced: false });
        await vi.waitFor(() => {
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
    });

    it("should not re-fetch when text changes but the URL set does not", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        vm.updateWithText({ content: "https://example.org", debounced: false });
        vm.updateWithText({ content: "https://example.org some extra words", debounced: false });
        await vi.waitFor(() => {
            expect(client.getUrlPreview).toHaveBeenCalledTimes(1);
        });
    });

    it("should deduplicate repeated URLs", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        vm.updateWithText({
            content: "https://example.org https://example.org https://example.org",
            debounced: false,
        });
        await vi.waitFor(() => {
            expect(client.getUrlPreview).toHaveBeenCalledTimes(1);
        });
    });

    it("should hide preview when made invisible", async () => {
        const { vm, client } = getViewModel();
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        vm.updateWithText({ content: "https://example.org", debounced: false });
        await vi.waitFor(() => {
            expect(vm.getSnapshot().entries).not.toHaveLength(0);
        });
        vm.updateUrlPreviewVisible(false);
        await vi.waitFor(() => {
            expect(vm.getSnapshot().entries).toHaveLength(0);
        });
    });

    it("should restore preview when made visible again", async () => {
        const { vm, client } = getViewModel({ visible: false });
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        vm.updateWithText({ content: "https://example.org", debounced: false });
        await vi.waitFor(() => {
            expect(vm.getSnapshot().entries).toHaveLength(0);
        });
        vm.updateUrlPreviewVisible(true);
        await vi.waitFor(() => {
            expect(vm.getSnapshot().entries).not.toHaveLength(0);
        });
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
        await vi.waitFor(() => {
            expect(vm.getSnapshot()).toEqual({
                content: "https://example.org",
                contentLinks: new Set(["https://example.org"]),
                isModified: true,
                entries: [
                    {
                        include: true,
                        matched_url: "https://example.org",
                        preview: {
                            image: {
                                fileSize: 10000,
                                height: 128,
                                imageFull: "https://example.org/image/src",
                                imageThumb: "https://example.org/image/thumb",
                                mxcImageFull: "mxc://example.org/abc",
                                playable: false,
                                width: 128,
                            },
                            link: "https://example.org",
                            ogUrl: "https://example.org",
                            showTooltipOnLink: false,
                            siteName: "example.org",
                            title: "Media example",
                        },
                        status: "loaded",
                    },
                ],
            });
        });
    });
    describe("restoreFromMessage", () => {
        it("should seed previews from the event's bundle without refetching them", async () => {
            const { vm, client } = restoreViewModel({
                "msgtype": MsgType.Text,
                "body": `Look at ${BUNDLE_ENTRY_ONE.matched_url} please`,
                "com.beeper.linkpreviews": [BUNDLE_ENTRY_ONE],
            });

            await vi.waitFor(() => {
                expect(vm.getSnapshot().entries.map(getEntrySummary)).toEqual([
                    { matched_url: BUNDLE_ENTRY_ONE.matched_url, include: true, status: "loaded" },
                ]);
            });
            expect(vm.getSnapshot()).toMatchObject({
                content: `Look at ${BUNDLE_ENTRY_ONE.matched_url} please`,
                contentLinks: new Set([BUNDLE_ENTRY_ONE.matched_url]),
                entries: [
                    {
                        preview: {
                            link: BUNDLE_ENTRY_ONE.matched_url,
                            title: "Bundled one",
                            description: "First bundled preview",
                            siteName: "example.org",
                            ogUrl: BUNDLE_ENTRY_ONE.matched_url,
                        },
                    },
                ],
            });
            // The bundle carries the metadata, so no server request is needed.
            expect(client.getUrlPreview).not.toHaveBeenCalled();
        });

        it("should not report a message seeded from a bundle as modified", () => {
            const { vm } = restoreViewModel({
                "msgtype": MsgType.Text,
                "body": BUNDLE_ENTRY_ONE.matched_url,
                "com.beeper.linkpreviews": [BUNDLE_ENTRY_ONE],
            });
            expect(vm.getSnapshot().isModified).toBe(false);
        });

        it("should seed an image preview from the bundle", async () => {
            const client = getMockClient();
            // eslint-disable-next-line no-restricted-properties
            client.mxcUrlToHttp.mockReturnValue("https://example.org/image/src");
            const { vm } = restoreViewModel(
                {
                    "msgtype": MsgType.Text,
                    "body": BUNDLE_ENTRY_WITH_IMAGE.matched_url,
                    "com.beeper.linkpreviews": [BUNDLE_ENTRY_WITH_IMAGE],
                },
                { client },
            );

            await vi.waitFor(() => {
                const [entry] = vm.getSnapshot().entries;
                expect(entry.status).toBe("loaded");
                expect(entry.status === "loaded" && entry.preview.image).toMatchObject({
                    mxcImageFull: IMAGE_MXC,
                    imageType: "image/png",
                    width: 128,
                    height: 128,
                });
            });
            expect(client.getUrlPreview).not.toHaveBeenCalled();
        });

        it("should exclude links in the body that the bundle omits", async () => {
            const { vm, client } = restoreViewModel({
                "msgtype": MsgType.Text,
                "body": `${BUNDLE_ENTRY_ONE.matched_url} https://example.org/removed`,
                "com.beeper.linkpreviews": [BUNDLE_ENTRY_ONE],
            });

            await vi.waitFor(() => {
                expect(vm.getSnapshot().entries.map(getEntrySummary)).toEqual([
                    { matched_url: BUNDLE_ENTRY_ONE.matched_url, include: true, status: "loaded" },
                    { matched_url: "https://example.org/removed", include: false, status: "failed" },
                ]);
            });
            // The omitted link was deliberately removed by the sender, so it must not be refetched.
            expect(client.getUrlPreview).not.toHaveBeenCalled();
        });

        it("should request a preview for a bundle entry that only carries matched_url", async () => {
            const client = getMockClient();
            client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
            const { vm } = restoreViewModel(
                {
                    "msgtype": MsgType.Text,
                    "body": "https://example.org",
                    "com.beeper.linkpreviews": [{ matched_url: "https://example.org" }],
                },
                { client },
            );

            await vi.waitFor(() => {
                expect(client.getUrlPreview).toHaveBeenCalledWith("https://example.org", expect.anything());
                expect(vm.getSnapshot().entries.map(getEntrySummary)).toEqual([
                    { matched_url: "https://example.org", include: true, status: "loaded" },
                ]);
            });
        });

        it("should mark a bundle entry as failed when its link is no longer in the body", async () => {
            const client = getMockClient();
            client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
            const { vm } = restoreViewModel(
                {
                    "msgtype": MsgType.Text,
                    "body": "https://example.org/other",
                    "com.beeper.linkpreviews": [BUNDLE_ENTRY_ONE],
                },
                { client },
            );

            // Only the link actually in the body is previewed; the stale bundle entry is dropped.
            await vi.waitFor(() => {
                expect(vm.getSnapshot().entries.map(getEntrySummary)).toEqual([
                    { matched_url: "https://example.org/other", include: false, status: "failed" },
                ]);
            });
        });

        it("should fetch previews normally when the message has no bundle", async () => {
            const client = getMockClient();
            client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
            const { vm } = restoreViewModel(
                {
                    msgtype: MsgType.Text,
                    body: "Check out https://example.org today",
                },
                { client },
            );

            await vi.waitFor(() => {
                expect(client.getUrlPreview).toHaveBeenCalledWith("https://example.org", expect.anything());
                expect(vm.getSnapshot().entries.map(getEntrySummary)).toEqual([
                    { matched_url: "https://example.org", include: true, status: "loaded" },
                ]);
            });
        });

        it("should ignore the bundle when the bundle feature is disabled", async () => {
            const client = getMockClient();
            client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
            const { vm } = restoreViewModel(
                {
                    "msgtype": MsgType.Text,
                    "body": BUNDLE_ENTRY_ONE.matched_url,
                    "com.beeper.linkpreviews": [BUNDLE_ENTRY_ONE],
                },
                { urlPreviewBundle: false, client },
            );

            await vi.waitFor(() => {
                expect(client.getUrlPreview).toHaveBeenCalledWith(BUNDLE_ENTRY_ONE.matched_url, expect.anything());
                expect(vm.getSnapshot().entries.map(getEntrySummary)).toEqual([
                    { matched_url: BUNDLE_ENTRY_ONE.matched_url, include: true, status: "loaded" },
                ]);
            });
        });

        it("should render no entries when previews are not visible", () => {
            const { vm, client } = restoreViewModel(
                {
                    "msgtype": MsgType.Text,
                    "body": BUNDLE_ENTRY_ONE.matched_url,
                    "com.beeper.linkpreviews": [BUNDLE_ENTRY_ONE],
                },
                { visible: false },
            );
            expect(vm.getSnapshot().entries).toHaveLength(0);
            expect(client.getUrlPreview).not.toHaveBeenCalled();
        });
    });
});
