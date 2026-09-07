/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type MockedObject } from "vitest";
import React from "react";
import { render, screen, waitFor } from "test-utils-rtl";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { stubClient, wrapInMatrixClientContext, mkRoom, wrapInSdkContext, TestSDKContext } from "test-utils";

import _RightPanel from "./RightPanel";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import ResizeNotifier from "../../utils/ResizeNotifier";
import { Action } from "../../dispatcher/actions";
import dis from "../../dispatcher/dispatcher";
import DMRoomMap from "../../utils/DMRoomMap";
import SettingsStore from "../../settings/SettingsStore";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../stores/right-panel/RightPanelStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import { WidgetLayoutStore } from "../../stores/widgets/WidgetLayoutStore";
import { RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";

const RightPanelBase = wrapInMatrixClientContext(_RightPanel);

describe("RightPanel", () => {
    const resizeNotifier = new ResizeNotifier();

    let cli: MockedObject<MatrixClient>;
    let context: TestSDKContext;
    let RightPanel: React.ComponentType<React.ComponentProps<typeof RightPanelBase>>;
    beforeEach(() => {
        stubClient();
        cli = vi.mocked(MatrixClientPeg.safeGet());
        DMRoomMap.makeShared(cli);
        context = new TestSDKContext();
        context._client = cli;
        RightPanel = wrapInSdkContext(RightPanelBase, context);
    });

    afterEach(async () => {
        const roomChanged = new Promise<void>((resolve) => {
            const ref = dis.register((payload) => {
                if (payload.action === Action.ActiveRoomChanged) {
                    dis.unregister(ref);
                    resolve();
                }
            });
        });
        dis.fire(Action.ViewHomePage); // Stop viewing any rooms
        await roomChanged;

        dis.fire(Action.OnLoggedOut, true); // Shut down the stores
        vi.restoreAllMocks();
    });

    const spinUpStores = async () => {
        // Selectively spin up the stores we need
        WidgetLayoutStore.instance.useUnitTestClient(cli);
        // @ts-ignore
        // This is private but it's the only way to selectively enable stores
        await WidgetLayoutStore.instance.onReady();

        // Make sure we start with a clean store
        RightPanelStore.instance.reset();
        RightPanelStore.instance.useUnitTestClient(cli);
        // @ts-ignore
        await RightPanelStore.instance.onReady();
    };

    const waitForRpsUpdate = () => new Promise<void>((resolve) => RightPanelStore.instance.once(UPDATE_EVENT, resolve));

    it("renders info from only one room during room changes", async () => {
        const r1 = mkRoom(cli, "r1");
        const r2 = mkRoom(cli, "r2");

        cli.getRoom.mockImplementation((roomId) => {
            if (roomId === "r1") return r1;
            if (roomId === "r2") return r2;
            return null;
        });

        // Set up right panel state
        const realGetValue = SettingsStore.getValue;
        vi.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
            if (name !== "RightPanel.phases") return realGetValue(name, roomId);
            if (roomId === "r1") {
                return {
                    history: [{ phase: RightPanelPhases.MemberList }],
                    isOpen: true,
                };
            }
            if (roomId === "r2") {
                return {
                    history: [{ phase: RightPanelPhases.RoomSummary }],
                    isOpen: true,
                };
            }
            return null;
        });

        await spinUpStores();

        // Run initial render with room 1, and also running lifecycle methods
        const { container, rerender } = render(
            <RightPanel
                room={r1}
                resizeNotifier={resizeNotifier}
                permalinkCreator={new RoomPermalinkCreator(r1, r1.roomId)}
            />,
        );
        // Wait for RPS room 1 updates to fire
        const rpsUpdated = waitForRpsUpdate();
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: "r1",
        });
        await rpsUpdated;
        await waitFor(() => expect(screen.queryByTestId("spinner")).not.toBeInTheDocument());

        // room one will be in the MemberList phase - confirm this is rendered
        expect(container.getElementsByClassName("mx_MemberListView")).toHaveLength(1);

        // wait for RPS room 2 updates to fire, then rerender
        const _rpsUpdated = waitForRpsUpdate();
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: "r2",
        });
        await _rpsUpdated;
        rerender(
            <RightPanel
                room={r2}
                resizeNotifier={resizeNotifier}
                permalinkCreator={new RoomPermalinkCreator(r2, r2.roomId)}
            />,
        );

        // After all that setup, now to the interesting part...
        // We want to verify that as we change to room 2, we should always have
        // the correct right panel state for whichever room we are showing, so we
        // confirm we do not have the MemberList class on the page and that we have
        // the expected room title
        expect(container.getElementsByClassName("mx_MemberListView")).toHaveLength(0);
        expect(screen.getByRole("heading", { name: "r2" })).toBeInTheDocument();
    });
});
