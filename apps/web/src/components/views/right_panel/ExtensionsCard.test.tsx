/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, vi, type Mocked } from "vitest";
import { render, screen } from "test-utils-rtl";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { MatrixWidgetType } from "matrix-widget-api";
import userEvent from "@testing-library/user-event";
import { clientAndSDKContextRenderOptions, stubClient, TestSDKContext } from "test-utils";

import ExtensionsCard from "./ExtensionsCard";
import { type IApp } from "../../../stores/WidgetStore";
import WidgetUtils, { useWidgets } from "../../../utils/WidgetUtils";
import { WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import { IntegrationManagers } from "../../../integrations/IntegrationManagers";

vi.mock("../../../utils/WidgetUtils");

vi.mock("../../../../res/img/element-icons/room/default_app.svg", () => ({ default: "image-file-stub" }));
vi.mock("../../../../res/img/element-icons/room/default_video.svg", () => ({ default: "image-file-stub" }));
vi.mock("../../../../res/img/element-icons/room/default_cal.svg", () => ({ default: "image-file-stub" }));
vi.mock("../../../../res/img/element-icons/room/default_doc.svg", () => ({ default: "image-file-stub" }));
vi.mock("../../../../res/img/element-icons/room/default_clock.svg", () => ({ default: "image-file-stub" }));

describe("<ExtensionsCard />", () => {
    let client: Mocked<MatrixClient>;
    let room: Room;
    let sdkContext: TestSDKContext;

    beforeEach(() => {
        client = vi.mocked(stubClient());
        sdkContext = new TestSDKContext();
        sdkContext._client = client;
        room = new Room("!room:server", client, client.getSafeUserId());
        vi.mocked(WidgetUtils.getWidgetName).mockImplementation((app) => app?.name ?? "No Name");
    });

    it("should render empty state", () => {
        vi.mocked(useWidgets).mockReturnValue([]);
        const { asFragment } = render(
            <ExtensionsCard room={room} onClose={vi.fn()} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        expect(screen.getByText("Boost productivity with more tools, widgets and bots")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render widgets", async () => {
        vi.mocked(useWidgets).mockReturnValue([
            {
                id: "id",
                roomId: room.roomId,
                eventId: "$event1",
                creatorUserId: client.getSafeUserId(),
                type: MatrixWidgetType.Custom,
                name: "Custom Widget",
                url: "http://url1",
            },
            {
                id: "jitsi",
                roomId: room.roomId,
                eventId: "$event2",
                creatorUserId: client.getSafeUserId(),
                type: MatrixWidgetType.JitsiMeet,
                name: "Jitsi",
                url: "http://jitsi",
            },
        ] satisfies IApp[]);

        const { asFragment } = render(
            <ExtensionsCard room={room} onClose={vi.fn()} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        expect(screen.getByText("Custom Widget")).toBeInTheDocument();
        expect(screen.getByText("Jitsi")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should show context menu on widget row", async () => {
        vi.spyOn(WidgetUtils, "canUserModifyWidgets").mockReturnValue(true);
        vi.mocked(useWidgets).mockReturnValue([
            {
                id: "id",
                roomId: room.roomId,
                eventId: "$event1",
                creatorUserId: client.getSafeUserId(),
                type: MatrixWidgetType.Custom,
                name: "Custom Widget",
                url: "http://url1",
            },
        ] satisfies IApp[]);

        const { container } = render(
            <ExtensionsCard room={room} onClose={vi.fn()} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        await userEvent.click(container.querySelector(".mx_ExtensionsCard_app_options")!);
        expect(document.querySelector(".mx_IconizedContextMenu")).toMatchSnapshot();
    });

    it("should show set room layout button", async () => {
        vi.spyOn(WidgetLayoutStore.instance, "canCopyLayoutToRoom").mockReturnValue(true);
        vi.mocked(useWidgets).mockReturnValue([
            {
                id: "id",
                roomId: room.roomId,
                eventId: "$event1",
                creatorUserId: client.getSafeUserId(),
                type: MatrixWidgetType.Custom,
                name: "Custom Widget",
                url: "http://url1",
            },
        ] satisfies IApp[]);

        render(<ExtensionsCard room={room} onClose={vi.fn()} />, clientAndSDKContextRenderOptions(client, sdkContext));
        expect(screen.getByText("Set layout for everyone")).toBeInTheDocument();
    });

    it("should show widget as pinned", async () => {
        vi.spyOn(WidgetLayoutStore.instance, "isInContainer").mockReturnValue(true);
        vi.mocked(useWidgets).mockReturnValue([
            {
                id: "id",
                roomId: room.roomId,
                eventId: "$event1",
                creatorUserId: client.getSafeUserId(),
                type: MatrixWidgetType.Custom,
                name: "Custom Widget",
                url: "http://url1",
            },
        ] satisfies IApp[]);

        render(<ExtensionsCard room={room} onClose={vi.fn()} />, clientAndSDKContextRenderOptions(client, sdkContext));
        expect(screen.getByText("Custom Widget").closest(".mx_ExtensionsCard_Button_pinned")).toBeInTheDocument();
    });

    it("should show cannot pin warning", async () => {
        vi.spyOn(WidgetLayoutStore.instance, "isInContainer").mockReturnValue(false);
        vi.spyOn(WidgetLayoutStore.instance, "canAddToContainer").mockReturnValue(false);
        vi.mocked(useWidgets).mockReturnValue([
            {
                id: "id",
                roomId: room.roomId,
                eventId: "$event1",
                creatorUserId: client.getSafeUserId(),
                type: MatrixWidgetType.Custom,
                name: "Custom Widget",
                url: "http://url1",
            },
        ] satisfies IApp[]);

        render(<ExtensionsCard room={room} onClose={vi.fn()} />, clientAndSDKContextRenderOptions(client, sdkContext));
        expect(screen.getByLabelText("You can only pin up to 3 widgets")).toBeInTheDocument();
    });

    it("should should open integration manager on click", async () => {
        vi.spyOn(IntegrationManagers.sharedInstance(), "hasManager").mockReturnValue(false);
        const spy = vi.spyOn(IntegrationManagers.sharedInstance(), "openNoManagerDialog");
        render(<ExtensionsCard room={room} onClose={vi.fn()} />, clientAndSDKContextRenderOptions(client, sdkContext));
        await userEvent.click(screen.getByText("Add extensions"));
        expect(spy).toHaveBeenCalled();
    });

    it("should set room layout on click", async () => {
        vi.mocked(useWidgets).mockReturnValue([
            {
                id: "id",
                roomId: room.roomId,
                eventId: "$event1",
                creatorUserId: client.getSafeUserId(),
                type: MatrixWidgetType.Custom,
                name: "Custom Widget",
                url: "http://url1",
            },
            {
                id: "jitsi",
                roomId: room.roomId,
                eventId: "$event2",
                creatorUserId: client.getSafeUserId(),
                type: MatrixWidgetType.JitsiMeet,
                name: "Jitsi",
                url: "http://jitsi",
            },
        ] satisfies IApp[]);

        vi.spyOn(sdkContext.widgetLayoutStore, "copyLayoutToRoom");
        render(<ExtensionsCard room={room} onClose={vi.fn()} />, clientAndSDKContextRenderOptions(client, sdkContext));
        await userEvent.click(screen.getByText("Set layout for everyone"));
        expect(sdkContext.widgetLayoutStore.copyLayoutToRoom).toHaveBeenCalledWith(room);
    });
});
