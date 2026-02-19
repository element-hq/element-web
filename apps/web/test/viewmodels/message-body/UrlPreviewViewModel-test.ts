/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import type { MockedObject } from "jest-mock";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { UrlPreviewViewModel } from "../../../src/viewmodels/message-body/UrlPreviewViewModel";
import { getMockClientWithEventEmitter, mkEvent } from "../../test-utils";

function getViewModel(): { vm: UrlPreviewViewModel; client: MockedObject<MatrixClient> } {
    const client = getMockClientWithEventEmitter({
        getUrlPreview: jest.fn(),
    });
    const vm = new UrlPreviewViewModel({
        client,
        mediaVisible: true,
        visible: true,
        onImageClicked: jest.fn(),
        mxEvent: mkEvent({
            event: true,
            user: "@foo:bar",
            type: "m.room.message",
            content: {},
            id: "$id",
        }),
    });
    return { vm, client };
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
        client.getUrlPreview.mockResolvedValueOnce({
            "og:title": "This is an example!",
            "og:type": "document",
            "og:url": "https://example.org",
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
    });
    it.todo("should preview a URL with media");
    it.todo("should ignore media when mediaVisible is false");
    it.todo("should deduplicate multiple versions of the same URL");
    it.todo("should ignore failed previews");
    it.todo("should handle image clicks");
    it.todo("should handle being hidden by the user");
    it.todo("should handle being shown by the user");
});
