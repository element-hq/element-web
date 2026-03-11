/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ComponentProps } from "react";
import { screen, render } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { type Room, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { MatrixWidgetType } from "matrix-widget-api";
import {
    type ApprovalOpts,
    type WidgetInfo,
    WidgetLifecycle,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/WidgetLifecycle";

import { WidgetContextMenu } from "../../../../../src/components/views/context_menus/WidgetContextMenu";
import { type IApp } from "../../../../../src/stores/WidgetStore";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import WidgetUtils from "../../../../../src/utils/WidgetUtils";
import { ModuleRunner } from "../../../../../src/modules/ModuleRunner";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { WidgetLayoutStore } from "../../../../../src/stores/widgets/WidgetLayoutStore";
import { mkStubRoom } from "../../../../test-utils/test-utils.ts";
import { type RoomContextType } from "../../../../../src/contexts/RoomContext.ts";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";

describe("<WidgetContextMenu />", () => {
    const widgetId = "w1";
    const eventId = "e1";
    const roomId = "r1";
    const userId = "@user-id:server";

    const app: IApp = {
        id: widgetId,
        eventId,
        roomId,
        type: MatrixWidgetType.Custom,
        url: "https://example.com",
        name: "Example 1",
        creatorUserId: userId,
        avatar_url: undefined,
    };

    let mockClient: MatrixClient;

    let room: Room;

    let onFinished: () => void;

    let roomContext: RoomContextType;

    beforeEach(() => {
        onFinished = jest.fn();
        jest.spyOn(WidgetUtils, "canUserModifyWidgets").mockReturnValue(true);

        mockClient = {
            getUserId: jest.fn().mockReturnValue(userId),
        } as unknown as MatrixClient;

        room = mkStubRoom(roomId, "Test Room", mockClient);

        roomContext = {
            room,
            roomId,
        } as unknown as RoomContextType;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function getComponent(props: Partial<ComponentProps<typeof WidgetContextMenu>> = {}): JSX.Element {
        return (
            <MatrixClientContext.Provider value={mockClient}>
                <ScopedRoomContextProvider {...roomContext}>
                    <WidgetContextMenu app={app} onFinished={onFinished} {...props} />
                </ScopedRoomContextProvider>
            </MatrixClientContext.Provider>
        );
    }

    it("renders revoke button", async () => {
        const { rerender } = render(getComponent());

        const revokeButton = screen.getByLabelText("Revoke permissions");
        expect(revokeButton).toBeInTheDocument();

        jest.spyOn(ModuleRunner.instance, "invoke").mockImplementation((lifecycleEvent, opts, widgetInfo) => {
            if (lifecycleEvent === WidgetLifecycle.PreLoadRequest && (widgetInfo as WidgetInfo).id === widgetId) {
                (opts as ApprovalOpts).approved = true;
            }
        });

        rerender(getComponent());
        expect(revokeButton).not.toBeInTheDocument();
    });

    it("revokes permissions", async () => {
        render(getComponent());
        await userEvent.click(screen.getByLabelText("Revoke permissions"));
        expect(onFinished).toHaveBeenCalled();
        expect(SettingsStore.getValue("allowedWidgets", roomId)[eventId]).toBe(false);
    });

    it("shows the move left button when the widget can be moved left", () => {
        // Place our widget second so it can move left but not right.
        jest.spyOn(WidgetLayoutStore.instance, "getContainerWidgets").mockReturnValue([
            { id: "someOtherWidget", type: "m.custom", creatorUserId: userId, url: "" },
            { id: widgetId, type: "m.custom", creatorUserId: userId, url: "" },
        ]);

        render(getComponent({ showUnpin: true }));

        expect(screen.getByLabelText("Move left")).toBeInTheDocument();
        expect(screen.queryByLabelText("Move right")).not.toBeInTheDocument();
    });

    it("shows the move right button when the widget can be moved right", () => {
        // Place our widget first so it can move right but not left.
        jest.spyOn(WidgetLayoutStore.instance, "getContainerWidgets").mockReturnValue([
            { id: widgetId, type: "m.custom", creatorUserId: userId, url: "" },
            { id: "someOtherWidget", type: "m.custom", creatorUserId: userId, url: "" },
        ]);

        render(getComponent({ showUnpin: true }));

        expect(screen.getByLabelText("Move right")).toBeInTheDocument();
        expect(screen.queryByLabelText("Move left")).not.toBeInTheDocument();
    });

    it("moves widget left when move left button is clicked", async () => {
        // Place our widget second so move left is visible.
        jest.spyOn(WidgetLayoutStore.instance, "getContainerWidgets").mockReturnValue([
            { id: "someOtherWidget", type: "m.custom", creatorUserId: userId, url: "" },
            { id: widgetId, type: "m.custom", creatorUserId: userId, url: "" },
        ]);

        // Mock moveWithinContainer to verify it's called with the correct arguments.
        const moveWithinContainerSpy = jest
            .spyOn(WidgetLayoutStore.instance, "moveWithinContainer")
            .mockImplementation();

        render(getComponent({ showUnpin: true }));

        await userEvent.click(screen.getByLabelText("Move left"));

        expect(moveWithinContainerSpy).toHaveBeenCalledWith(room, "top", app, -1);
        expect(onFinished).toHaveBeenCalled();
    });

    it("moves widget right when move right button is clicked", async () => {
        // Place our widget first so move right is visible.
        jest.spyOn(WidgetLayoutStore.instance, "getContainerWidgets").mockReturnValue([
            { id: widgetId, type: "m.custom", creatorUserId: userId, url: "" },
            { id: "someOtherWidget", type: "m.custom", creatorUserId: userId, url: "" },
        ]);

        // Mock moveWithinContainer to verify it's called with the correct arguments.
        const moveWithinContainerSpy = jest
            .spyOn(WidgetLayoutStore.instance, "moveWithinContainer")
            .mockImplementation();

        render(getComponent({ showUnpin: true }));
        await userEvent.click(screen.getByLabelText("Move right"));

        expect(moveWithinContainerSpy).toHaveBeenCalledWith(room, "top", app, 1);
        expect(onFinished).toHaveBeenCalled();
    });
});
