/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventType, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { MBodyTileViewModel } from "./MBodyTileViewModel";
import { ModuleApi } from "../../modules/Api";
import { type RegisteredFileViewer } from "../../modules/FileViewerApi";
import { type MediaEventHelper } from "../../utils/MediaEventHelper";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";
import type RightPanelStore from "../../stores/right-panel/RightPanelStore";

function mkViewer(id: string): RegisteredFileViewer {
    return {
        match: () => true,
        render: vi.fn(),
        options: { id, cardHeader: () => id, buttonText: `Open with ${id}`, buttonIcon: <span /> },
    };
}

describe("MBodyTileViewModel", () => {
    const mxEvent = new MatrixEvent({
        room_id: "!room:example.org",
        sender: "@user:example.org",
        event_id: "$file",
        type: EventType.RoomMessage,
        content: {
            body: "spec.pdf",
            msgtype: MsgType.File,
            url: "mxc://example.org/spec",
            info: { mimetype: "application/pdf", size: 1234 },
        },
    });
    const mediaEventHelper = {
        fileName: "spec.pdf",
        sourceBlob: { value: Promise.resolve(new Blob(["%PDF"])) },
    } as unknown as MediaEventHelper;

    let rightPanelStore: RightPanelStore;

    beforeEach(() => {
        rightPanelStore = { setCard: vi.fn() } as unknown as RightPanelStore;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const buttonLabels = (vm: MBodyTileViewModel): string[] =>
        vm.getSnapshot().entries[0].buttons!.map((button) => button.label);

    it("asks the module API for viewers of the uploaded file", () => {
        const getViewersFor = vi.spyOn(ModuleApi.instance.fileViewer, "getViewersFor").mockReturnValue([]);

        new MBodyTileViewModel(mxEvent, mediaEventHelper, rightPanelStore);

        expect(getViewersFor).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "uploaded",
                name: "spec.pdf",
                mimetype: "application/pdf",
                byteSize: 1234,
            }),
        );
    });

    it("offers no extra buttons when no module viewer accepts the file", () => {
        vi.spyOn(ModuleApi.instance.fileViewer, "getViewersFor").mockReturnValue([]);

        const vm = new MBodyTileViewModel(mxEvent, mediaEventHelper, rightPanelStore);

        expect(buttonLabels(vm)).toEqual(["Download"]);
    });

    it("puts the module viewer buttons before the built-in viewer and download buttons", () => {
        vi.spyOn(ModuleApi.instance.fileViewer, "getViewersFor").mockReturnValue([mkViewer("a"), mkViewer("b")]);

        const vm = new MBodyTileViewModel(mxEvent, mediaEventHelper, rightPanelStore, true);

        expect(buttonLabels(vm)).toEqual(["Open with a", "Open with b", "Open PDF", "Download"]);
    });

    it("keeps the module viewer buttons when the document previews lab is toggled", () => {
        vi.spyOn(ModuleApi.instance.fileViewer, "getViewersFor").mockReturnValue([mkViewer("a")]);
        const vm = new MBodyTileViewModel(mxEvent, mediaEventHelper, rightPanelStore);

        vm.setDocumentPreviewsEnabled(true);
        expect(buttonLabels(vm)).toEqual(["Open with a", "Open PDF", "Download"]);

        vm.setDocumentPreviewsEnabled(false);
        expect(buttonLabels(vm)).toEqual(["Open with a", "Download"]);
    });

    it("opens the module viewer in the given right panel store", () => {
        const viewer = mkViewer("a");
        vi.spyOn(ModuleApi.instance.fileViewer, "getViewersFor").mockReturnValue([viewer]);
        const vm = new MBodyTileViewModel(mxEvent, mediaEventHelper, rightPanelStore);

        vm.getSnapshot().entries[0].buttons![0].onClick();

        expect(rightPanelStore.setCard).toHaveBeenCalledWith({
            phase: RightPanelPhases.FileViewer,
            state: {
                fileViewer: viewer,
                fileViewerMedia: expect.objectContaining({ type: "uploaded", name: "spec.pdf" }),
                fileViewerSourceEvent: mxEvent,
            },
        });
    });
});
