/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, fireEvent } from "jest-matrix-react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import FileBrowserCard from "../../../../../src/components/views/right_panel/FileBrowserCard";
import { SDKContext } from "../../../../../src/contexts/SDKContext";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { RightPanelPhases } from "../../../../../src/stores/right-panel/RightPanelStorePhases";
import { listRoomFiles } from "../../../../../src/utils/roomFiles";
import { stubClient, TestSDKContext } from "../../../../test-utils";

jest.mock("../../../../../src/utils/roomFiles", () => ({
    listRoomFiles: jest.fn(),
}));

describe("<FileBrowserCard />", () => {
    let sdkContext: TestSDKContext;
    let client: MatrixClient;
    const setCard = jest.fn();

    // Note: an explicit `undefined` argument would fall back to a default parameter, so the
    // no-room case is expressed by omitting the key rather than passing undefined.
    const renderCard = ({ roomId }: { roomId?: string } = { roomId: "!room:server" }) =>
        render(
            <MatrixClientContext.Provider value={client}>
                <SDKContext.Provider value={sdkContext}>
                    <FileBrowserCard roomId={roomId} onClose={jest.fn()} />
                </SDKContext.Provider>
            </MatrixClientContext.Provider>,
        );

    beforeEach(() => {
        client = stubClient();
        jest.clearAllMocks();
        jest.mocked(listRoomFiles).mockResolvedValue([
            { eventId: "$1", name: "contract.pdf (12 KB)", ts: 2 },
            { eventId: "$2", name: "notes.docx (4 KB)", ts: 1 },
        ]);

        sdkContext = new TestSDKContext();
        sdkContext._RightPanelStore = { setCard, roomPhaseHistory: [] } as any;
    });

    it("lists the three sources with Files selected", async () => {
        renderCard();

        expect(screen.getByRole("tab", { name: "Files" })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tab", { name: "Chat" })).toHaveAttribute("aria-selected", "false");

        expect(await screen.findByRole("treeitem", { name: /Room/ })).toBeInTheDocument();
        expect(screen.getByRole("treeitem", { name: /NextCloud/ })).toBeInTheDocument();
        expect(screen.getByRole("treeitem", { name: /OneDrive/ })).toBeInTheDocument();
    });

    it("shows the room's own files as a flat list, with no folders", async () => {
        renderCard();

        expect(await screen.findByRole("treeitem", { name: /contract\.pdf/ })).toBeInTheDocument();
        expect(screen.getByRole("treeitem", { name: /notes\.docx/ })).toBeInTheDocument();

        // A room has no folder structure, so its files sit directly under the source.
        expect(screen.getByRole("treeitem", { name: /contract\.pdf/ })).not.toHaveAttribute("aria-expanded");
        expect(listRoomFiles).toHaveBeenCalledWith(client, "!room:server");
    });

    it("tells the user when the room has no files", async () => {
        jest.mocked(listRoomFiles).mockResolvedValue([]);
        renderCard();

        expect(await screen.findByText("No files in this room yet")).toBeInTheDocument();
    });

    it("still renders when there is no room", async () => {
        renderCard({});

        expect(await screen.findByText("No files in this room yet")).toBeInTheDocument();
        expect(listRoomFiles).not.toHaveBeenCalled();
    });

    it("expands a provider and then a folder to reveal its files", async () => {
        renderCard();

        expect(screen.queryByRole("treeitem", { name: /q3-report\.pdf/ })).not.toBeInTheDocument();

        fireEvent.click(await screen.findByRole("treeitem", { name: /NextCloud/ }));
        fireEvent.click(screen.getByRole("treeitem", { name: /Shared with me/ }));

        expect(screen.getByRole("treeitem", { name: /q3-report\.pdf/ })).toBeInTheDocument();
    });

    it("switches the panel back to chat", async () => {
        renderCard();

        fireEvent.click(screen.getByRole("tab", { name: "Chat" }));

        expect(setCard).toHaveBeenCalledWith({ phase: RightPanelPhases.Timeline });
    });
});
