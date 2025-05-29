/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked, type Mocked } from "jest-mock";
import { render, screen } from "jest-matrix-react";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { MatrixWidgetType } from "matrix-widget-api";
import userEvent from "@testing-library/user-event";

import ExtensionsCard from "../../../../../src/components/views/right_panel/ExtensionsCard";
import { stubClient } from "../../../../test-utils";
import { type IApp } from "../../../../../src/stores/WidgetStore";
import WidgetUtils, { useWidgets } from "../../../../../src/utils/WidgetUtils";
import { WidgetLayoutStore } from "../../../../../src/stores/widgets/WidgetLayoutStore";
import { IntegrationManagers } from "../../../../../src/integrations/IntegrationManagers";

jest.mock("../../../../../src/utils/WidgetUtils");

describe("<ExtensionsCard />", () => {
    let client: Mocked<MatrixClient>;
    let room: Room;

    beforeEach(() => {
        client = mocked(stubClient());
        room = new Room("!room:server", client, client.getSafeUserId());
        mocked(WidgetUtils.getWidgetName).mockImplementation((app) => app?.name ?? "No Name");
    });

    it("should render empty state", () => {
        mocked(useWidgets).mockReturnValue([]);
        const { asFragment } = render(<ExtensionsCard room={room} onClose={jest.fn()} />);
        expect(screen.getByText("Boost productivity with more tools, widgets and bots")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should render widgets", async () => {
        mocked(useWidgets).mockReturnValue([
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

        const { asFragment } = render(<ExtensionsCard room={room} onClose={jest.fn()} />);
        expect(screen.getByText("Custom Widget")).toBeInTheDocument();
        expect(screen.getByText("Jitsi")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should show context menu on widget row", async () => {
        jest.spyOn(WidgetUtils, "canUserModifyWidgets").mockReturnValue(true);
        mocked(useWidgets).mockReturnValue([
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

        const { container } = render(<ExtensionsCard room={room} onClose={jest.fn()} />);
        await userEvent.click(container.querySelector(".mx_ExtensionsCard_app_options")!);
        expect(document.querySelector(".mx_IconizedContextMenu")).toMatchSnapshot();
    });

    it("should show set room layout button", async () => {
        jest.spyOn(WidgetLayoutStore.instance, "canCopyLayoutToRoom").mockReturnValue(true);
        mocked(useWidgets).mockReturnValue([
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

        render(<ExtensionsCard room={room} onClose={jest.fn()} />);
        expect(screen.getByText("Set layout for everyone")).toBeInTheDocument();
    });

    it("should show widget as pinned", async () => {
        jest.spyOn(WidgetLayoutStore.instance, "isInContainer").mockReturnValue(true);
        mocked(useWidgets).mockReturnValue([
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

        render(<ExtensionsCard room={room} onClose={jest.fn()} />);
        expect(screen.getByText("Custom Widget").closest(".mx_ExtensionsCard_Button_pinned")).toBeInTheDocument();
    });

    it("should show cannot pin warning", async () => {
        jest.spyOn(WidgetLayoutStore.instance, "isInContainer").mockReturnValue(false);
        jest.spyOn(WidgetLayoutStore.instance, "canAddToContainer").mockReturnValue(false);
        mocked(useWidgets).mockReturnValue([
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

        render(<ExtensionsCard room={room} onClose={jest.fn()} />);
        expect(screen.getByLabelText("You can only pin up to 3 widgets")).toBeInTheDocument();
    });

    it("should should open integration manager on click", async () => {
        jest.spyOn(IntegrationManagers.sharedInstance(), "hasManager").mockReturnValue(false);
        const spy = jest.spyOn(IntegrationManagers.sharedInstance(), "openNoManagerDialog");
        render(<ExtensionsCard room={room} onClose={jest.fn()} />);
        await userEvent.click(screen.getByText("Add extensions"));
        expect(spy).toHaveBeenCalled();
    });
});
