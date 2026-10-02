/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventType, type MatrixClient, MatrixEvent, MsgType, type Room } from "matrix-js-sdk/src/matrix";
import type { MediaHandle } from "@element-hq/element-web-module-api";
import type { UrlPreview } from "shared-types";
import { mkStubRoom, stubClient } from "test-utils";

import { convertToStatePanel, convertToStorePanel, type IRightPanelForRoom } from "./RightPanelStoreIPanelState";
import { RightPanelPhases } from "./RightPanelStorePhases";
import { ModuleApi } from "../../modules/Api";
import { type RegisteredFileViewer } from "../../modules/FileViewerApi";

const ROOM_ID = "!room:example.org";

const PREVIEW: UrlPreview = {
    link: "https://example.org/spec.pdf",
    title: "Spec",
    siteName: "example.org",
    showTooltipOnLink: false,
};

const VIEWER: RegisteredFileViewer = {
    match: () => true,
    render: vi.fn(),
    options: { id: "test-viewer", cardHeader: () => "Viewer", buttonText: "Open", buttonIcon: createElement("span") },
};

describe("RightPanelStoreIPanelState", () => {
    let client: MatrixClient;
    let room: Room;
    let fileEvent: MatrixEvent;

    beforeEach(() => {
        client = stubClient();
        room = mkStubRoom(ROOM_ID, "Room", client);
        vi.mocked(client.getRoom).mockImplementation((roomId) => (roomId === ROOM_ID ? room : null));

        fileEvent = new MatrixEvent({
            room_id: ROOM_ID,
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
        vi.mocked(room.findEventById).mockImplementation((eventId) => (eventId === "$file" ? fileEvent : undefined));

        vi.spyOn(ModuleApi.instance.fileViewer, "getViewerById").mockImplementation((id) =>
            id === VIEWER.options.id ? VIEWER : undefined,
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** Persist a single file viewer card and load it back, as the store does across reloads. */
    const roundTrip = (media: MediaHandle): IRightPanelForRoom | null => {
        const stored = convertToStorePanel({
            isOpen: true,
            history: [
                {
                    phase: RightPanelPhases.FileViewer,
                    state: { fileViewer: VIEWER, fileViewerMedia: media, fileViewerSourceEvent: fileEvent },
                },
            ],
        });
        // Settings are stored as JSON, so nothing but plain data may survive.
        return convertToStatePanel(JSON.parse(JSON.stringify(stored)), room);
    };

    it("stores a file viewer card by the IDs of its viewer, event and room", () => {
        const stored = convertToStorePanel({
            isOpen: true,
            history: [
                {
                    phase: RightPanelPhases.FileViewer,
                    state: {
                        fileViewer: VIEWER,
                        fileViewerMedia: { type: "remote", preview: PREVIEW },
                        fileViewerSourceEvent: fileEvent,
                    },
                },
            ],
        });

        expect(stored?.history[0].state).toMatchObject({
            fileViewerId: "test-viewer",
            fileViewerSourceEventId: "$file",
            fileViewerSourceRoomId: ROOM_ID,
            fileViewerUrlPreview: PREVIEW,
        });
    });

    it("restores a card viewing an uploaded file from the source event", () => {
        const media: MediaHandle = { type: "uploaded", name: "spec.pdf", blob: vi.fn() };

        const state = roundTrip(media)?.history[0].state;

        expect(state?.fileViewer).toBe(VIEWER);
        expect(state?.fileViewerSourceEvent).toBe(fileEvent);
        expect(state?.fileViewerMedia).toMatchObject({
            type: "uploaded",
            name: "spec.pdf",
            mimetype: "application/pdf",
            byteSize: 1234,
        });
    });

    it("restores a card viewing a URL preview from the stored preview", () => {
        const state = roundTrip({ type: "remote", preview: PREVIEW })?.history[0].state;

        expect(state?.fileViewerSourceEvent).toBe(fileEvent);
        expect(state?.fileViewerMedia).toEqual({ type: "remote", preview: { ...PREVIEW, image: undefined } });
    });

    it("restores no media when the source event can no longer be found", () => {
        vi.mocked(room.findEventById).mockReturnValue(undefined);

        const state = roundTrip({ type: "uploaded", name: "spec.pdf", blob: vi.fn() })?.history[0].state;

        expect(state?.fileViewer).toBe(VIEWER);
        expect(state?.fileViewerSourceEvent).toBeUndefined();
        expect(state?.fileViewerMedia).toBeUndefined();
    });

    it("restores no viewer when the module that registered it is gone", () => {
        vi.mocked(ModuleApi.instance.fileViewer.getViewerById).mockReturnValue(undefined);

        expect(roundTrip({ type: "remote", preview: PREVIEW })?.history[0].state?.fileViewer).toBeUndefined();
    });
});
