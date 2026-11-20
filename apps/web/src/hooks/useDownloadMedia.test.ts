/*
Copyright 2026 Alar Mäerand

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "test-utils-rtl";
import fetchMock from "@fetch-mock/vitest";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";

import { useDownloadMedia } from "./useDownloadMedia";
import { FileDownloader } from "../utils/FileDownloader";
import { MediaEventHelper } from "../utils/MediaEventHelper";

vi.mock("../utils/FileDownloader");

describe("useDownloadMedia", () => {
    const itemBlob = new Blob(["ITEM"], { type: "image/png" });

    const makeItemHelper = (): MediaEventHelper =>
        ({
            sourceBlob: { value: Promise.resolve(itemBlob) },
            fileName: "item.png",
        }) as unknown as MediaEventHelper;

    // A gallery has no media of its own: a helper for the event as a whole cannot be made.
    const makeGalleryEvent = (): MatrixEvent =>
        new MatrixEvent({
            event_id: "$gallery",
            type: "m.room.message",
            sender: "@alice:example.org",
            room_id: "!room:example.org",
            content: {
                msgtype: "dm.filament.gallery",
                body: "The caption",
                itemtypes: [{ itemtype: "m.image", body: "item.png", url: "mxc://test.dummy/item.png" }],
            },
        });

    const downloader = (): FileDownloader => vi.mocked(FileDownloader).mock.instances[0];

    beforeEach(() => {
        stubClient();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("downloads through the helper it is given, without making one for the event", async () => {
        const mxEvent = makeGalleryEvent();
        expect(() => new MediaEventHelper(mxEvent)).toThrow();

        const { result } = renderHook(() =>
            useDownloadMedia("https://test.dummy/fromUrl.png", "fromName.png", mxEvent, makeItemHelper()),
        );
        expect(result.current.canDownload).toBe(true);

        await act(() => result.current.download());

        expect(downloader().download).toHaveBeenCalledTimes(1);
        expect(downloader().download).toHaveBeenCalledWith({ blob: itemBlob, name: "item.png" });
        expect(fetchMock).not.toHaveFetched("https://test.dummy/fromUrl.png");
        await waitFor(() => expect(result.current.loading).toBe(false));
    });

    it("downloads through the helper it is given even without an event", async () => {
        const { result } = renderHook(() =>
            useDownloadMedia("https://test.dummy/fromUrl.png", "fromName.png", undefined, makeItemHelper()),
        );

        await act(() => result.current.download());

        expect(downloader().download).toHaveBeenCalledWith({ blob: itemBlob, name: "item.png" });
        expect(fetchMock).not.toHaveFetched("https://test.dummy/fromUrl.png");
    });

    it("downloads the media of the event when no helper is given", async () => {
        fetchMock.get("http://this.is.a.url/test.dummy/fromEvent.png", "FROM EVENT");
        const mxEvent = new MatrixEvent({
            event_id: "$image",
            type: "m.room.message",
            content: { msgtype: "m.image", body: "fromEvent.png", url: "mxc://test.dummy/fromEvent.png" },
        });

        const { result } = renderHook(() =>
            useDownloadMedia("https://test.dummy/fromUrl.png", "fromName.png", mxEvent),
        );

        await act(() => result.current.download());

        expect(downloader().download).toHaveBeenCalledWith({ blob: expect.anything(), name: "fromEvent.png" });
        expect(fetchMock).toHaveFetched("http://this.is.a.url/test.dummy/fromEvent.png");
        expect(fetchMock).not.toHaveFetched("https://test.dummy/fromUrl.png");
    });

    it("fetches the URL when there is neither a helper nor an event", async () => {
        fetchMock.get("https://test.dummy/fromUrl.png", "FROM URL");

        const { result } = renderHook(() => useDownloadMedia("https://test.dummy/fromUrl.png", "fromName.png"));

        await act(() => result.current.download());

        expect(downloader().download).toHaveBeenCalledWith({ blob: expect.anything(), name: "fromName.png" });
        expect(fetchMock).toHaveFetched("https://test.dummy/fromUrl.png");
    });
});
