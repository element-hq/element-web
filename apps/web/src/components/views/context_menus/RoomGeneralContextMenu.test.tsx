/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { fireEvent, getByLabelText, render, screen } from "test-utils-rtl";
import { ReceiptType, type MatrixClient, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { sleep } from "matrix-js-sdk/src/utils";
import { mkMessage, stubClient } from "test-utils/test-utils";
import { clearAllModals } from "test-utils";

import { ChevronFace } from "../../structures/ContextMenu";
import { RoomGeneralContextMenu, type RoomGeneralContextMenuProps } from "./RoomGeneralContextMenu";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { DefaultTagID } from "../../../stores/room-list-v3/skip-list/tag";
import DMRoomMap from "../../../utils/DMRoomMap";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import SettingsStore from "../../../settings/SettingsStore";
import * as getTagsForRoomUtils from "../../../utils/room/getTagsForRoom";

vi.mock("../../../customisations/helpers/UIComponents", () => ({
    shouldShowComponent: vi.fn(),
}));

describe("RoomGeneralContextMenu", () => {
    const ROOM_ID = "!123:matrix.org";

    let room: Room;
    let mockClient: MatrixClient;

    let onFinished: () => void;

    function getComponent(props?: Partial<RoomGeneralContextMenuProps>) {
        return render(
            <MatrixClientContext.Provider value={mockClient}>
                <RoomGeneralContextMenu
                    room={room}
                    onFinished={onFinished}
                    {...props}
                    managed={true}
                    mountAsChild={true}
                    left={1}
                    top={1}
                    chevronFace={ChevronFace.Left}
                />
            </MatrixClientContext.Provider>,
        );
    }

    beforeEach(() => {
        vi.clearAllMocks();

        stubClient();
        mockClient = vi.mocked(MatrixClientPeg.safeGet());

        room = new Room(ROOM_ID, mockClient, mockClient.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const dmRoomMap = {
            getUserIdForRoomId: vi.fn(),
        } as unknown as DMRoomMap;
        DMRoomMap.setShared(dmRoomMap);

        vi.spyOn(getTagsForRoomUtils, "getTagsForRoom").mockReturnValueOnce([DefaultTagID.DM, DefaultTagID.Favourite]);

        onFinished = vi.fn();
    });

    afterEach(async () => {
        await clearAllModals();
    });

    it("renders an empty context menu for archived rooms", async () => {
        vi.spyOn(getTagsForRoomUtils, "getTagsForRoom").mockReturnValueOnce([DefaultTagID.Archived]);

        const { container } = getComponent({});
        expect(container).toMatchSnapshot();
    });

    it("renders the default context menu", async () => {
        const { container } = getComponent({});
        expect(container).toMatchSnapshot();
    });

    it("does not render invite menu item when UIComponent customisations disable room invite", () => {
        room.updateMyMembership(KnownMembership.Join);
        vi.spyOn(room, "canInvite").mockReturnValue(true);
        vi.mocked(shouldShowComponent).mockReturnValue(false);

        getComponent({});

        expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.InviteUsers);
        expect(screen.queryByRole("menuitem", { name: "Invite" })).not.toBeInTheDocument();
    });

    it("renders invite menu item when UIComponent customisations enables room invite", () => {
        room.updateMyMembership(KnownMembership.Join);
        vi.spyOn(room, "canInvite").mockReturnValue(true);
        vi.mocked(shouldShowComponent).mockReturnValue(true);

        getComponent({});

        expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.InviteUsers);
        expect(screen.getByRole("menuitem", { name: "Invite" })).toBeInTheDocument();
    });

    it("marks the room as read", async () => {
        const event = mkMessage({
            event: true,
            room: "!room:id",
            user: "@user:id",
            ts: 1000,
        });
        room.addLiveEvents([event], { addToState: true });

        const { container } = getComponent({});

        const markAsReadBtn = getByLabelText(container, "Mark as read");
        fireEvent.click(markAsReadBtn);

        await sleep(0);

        expect(mockClient.sendReadReceipt).toHaveBeenCalledWith(event, ReceiptType.Read, true);
        expect(onFinished).toHaveBeenCalled();
    });

    it("marks the room as unread", async () => {
        room.updateMyMembership("join");

        const { container } = getComponent({});

        const markAsUnreadBtn = getByLabelText(container, "Mark as unread");
        fireEvent.click(markAsUnreadBtn);

        await sleep(0);

        expect(mockClient.setRoomAccountData).toHaveBeenCalledWith(ROOM_ID, "m.marked_unread", {
            unread: true,
        });
        expect(onFinished).toHaveBeenCalled();
    });

    it("when developer mode is disabled, it should not render the developer tools option", () => {
        getComponent();
        expect(screen.queryByText("Developer tools")).not.toBeInTheDocument();
    });

    describe("when developer mode is enabled", () => {
        beforeEach(() => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((setting) => setting === "developerMode");
            getComponent();
        });

        it("should render the developer tools option", async () => {
            const developerToolsItem = screen.getByRole("menuitem", { name: "Developer tools" });
            expect(developerToolsItem).toBeInTheDocument();

            // click open developer tools dialog
            await userEvent.click(developerToolsItem);

            // assert that the dialog is displayed by searching some if its contents
            expect(await screen.findByText("Toolbox")).toBeInTheDocument();
            expect(await screen.findByText(`Room ID: ${ROOM_ID}`)).toBeInTheDocument();
        });
    });
});
