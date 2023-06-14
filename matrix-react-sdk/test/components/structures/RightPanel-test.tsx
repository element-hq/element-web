/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
// eslint-disable-next-line deprecate/import
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jest } from "@jest/globals";
import { mocked, MockedObject } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/client";

import _RightPanel from "../../../src/components/structures/RightPanel";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { stubClient, wrapInMatrixClientContext, mkRoom, wrapInSdkContext } from "../../test-utils";
import { Action } from "../../../src/dispatcher/actions";
import dis from "../../../src/dispatcher/dispatcher";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import SettingsStore from "../../../src/settings/SettingsStore";
import { RightPanelPhases } from "../../../src/stores/right-panel/RightPanelStorePhases";
import RightPanelStore from "../../../src/stores/right-panel/RightPanelStore";
import { UPDATE_EVENT } from "../../../src/stores/AsyncStore";
import { WidgetLayoutStore } from "../../../src/stores/widgets/WidgetLayoutStore";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import { RoomPermalinkCreator } from "../../../src/utils/permalinks/Permalinks";

const RightPanelBase = wrapInMatrixClientContext(_RightPanel);

describe("RightPanel", () => {
    const resizeNotifier = new ResizeNotifier();

    let cli: MockedObject<MatrixClient>;
    let context: SdkContextClass;
    let RightPanel: React.ComponentType<React.ComponentProps<typeof RightPanelBase>>;
    beforeEach(() => {
        stubClient();
        cli = mocked(MatrixClientPeg.safeGet());
        DMRoomMap.makeShared(cli);
        context = new SdkContextClass();
        context.client = cli;
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
        jest.restoreAllMocks();
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

    it("navigates from room summary to member list", async () => {
        const r1 = mkRoom(cli, "r1");
        cli.getRoom.mockImplementation((roomId) => (roomId === "r1" ? r1 : null));

        // Set up right panel state
        const realGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
            if (name !== "RightPanel.phases") return realGetValue(name, roomId);
            if (roomId === "r1") {
                return {
                    history: [{ phase: RightPanelPhases.RoomSummary }],
                    isOpen: true,
                };
            }
            return null;
        });

        await spinUpStores();
        const viewedRoom = waitForRpsUpdate();
        dis.dispatch({
            action: Action.ViewRoom,
            room_id: "r1",
        });
        await viewedRoom;

        const { container } = render(
            <RightPanel
                room={r1}
                resizeNotifier={resizeNotifier}
                permalinkCreator={new RoomPermalinkCreator(r1, r1.roomId)}
            />,
        );
        expect(container.getElementsByClassName("mx_RoomSummaryCard")).toHaveLength(1);

        const switchedPhases = waitForRpsUpdate();
        userEvent.click(screen.getByText(/people/i));
        await switchedPhases;

        expect(container.getElementsByClassName("mx_MemberList")).toHaveLength(1);
    });

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
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
            if (name !== "RightPanel.phases") return realGetValue(name, roomId);
            if (roomId === "r1") {
                return {
                    history: [{ phase: RightPanelPhases.RoomMemberList }],
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

        // room one will be in the RoomMemberList phase - confirm this is rendered
        expect(container.getElementsByClassName("mx_MemberList")).toHaveLength(1);

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
        expect(container.getElementsByClassName("mx_MemberList")).toHaveLength(0);
        expect(screen.getByRole("heading", { name: "r2" })).toBeInTheDocument();
    });
});
