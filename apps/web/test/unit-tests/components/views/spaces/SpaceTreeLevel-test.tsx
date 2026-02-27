/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, getByTestId, render } from "jest-matrix-react";
import { mocked } from "jest-mock";

import { mkRoom, stubClient } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { SpaceItem, SpaceButton } from "../../../../../src/components/views/spaces/SpaceTreeLevel";
import { MetaSpace, type SpaceKey } from "../../../../../src/stores/spaces";
import SpaceStore from "../../../../../src/stores/spaces/SpaceStore";
import { StaticNotificationState } from "../../../../../src/stores/notifications/StaticNotificationState";
import { NotificationLevel } from "../../../../../src/stores/notifications/NotificationLevel";

jest.mock("../../../../../src/stores/spaces/SpaceStore", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const EventEmitter = require("events");
    class MockSpaceStore extends EventEmitter {
        activeSpace: SpaceKey = "!space1";
        setActiveSpace = jest.fn();
        getChildSpaces = jest.fn();
        getNotificationState = jest.fn();
    }

    return { instance: new MockSpaceStore() };
});

describe("SpaceButton", () => {
    stubClient();
    const space = mkRoom(MatrixClientPeg.safeGet(), "!1:example.org");
    DMRoomMap.makeShared(MatrixClientPeg.safeGet());

    const dispatchSpy = jest.spyOn(defaultDispatcher, "dispatch");

    afterEach(jest.clearAllMocks);

    describe("real space", () => {
        it("activates the space on click", () => {
            const { container } = render(
                <SpaceButton
                    space={space}
                    selected={false}
                    label="My space"
                    data-testid="create-space-button"
                    size="32px"
                />,
            );

            expect(SpaceStore.instance.setActiveSpace).not.toHaveBeenCalled();
            fireEvent.click(getByTestId(container, "create-space-button"));
            expect(SpaceStore.instance.setActiveSpace).toHaveBeenCalledWith("!1:example.org");
        });

        it("navigates to the space home on click if already active", () => {
            const { container } = render(
                <SpaceButton
                    space={space}
                    selected={true}
                    label="My space"
                    data-testid="create-space-button"
                    size="32px"
                />,
            );

            expect(dispatchSpy).not.toHaveBeenCalled();
            fireEvent.click(getByTestId(container, "create-space-button"));
            expect(dispatchSpy).toHaveBeenCalledWith({ action: Action.ViewRoom, room_id: "!1:example.org" });
        });
    });

    describe("metaspace", () => {
        it("activates the metaspace on click", () => {
            const { container } = render(
                <SpaceButton
                    spaceKey={MetaSpace.People}
                    selected={false}
                    label="People"
                    data-testid="create-space-button"
                    size="32px"
                />,
            );

            expect(SpaceStore.instance.setActiveSpace).not.toHaveBeenCalled();
            fireEvent.click(getByTestId(container, "create-space-button"));
            expect(SpaceStore.instance.setActiveSpace).toHaveBeenCalledWith(MetaSpace.People);
        });

        it("does nothing on click if already active", () => {
            const { container } = render(
                <SpaceButton
                    spaceKey={MetaSpace.People}
                    selected={true}
                    label="People"
                    data-testid="create-space-button"
                    size="32px"
                />,
            );

            fireEvent.click(getByTestId(container, "create-space-button"));
            expect(dispatchSpy).not.toHaveBeenCalled();
            // Re-activating the metaspace is a no-op
            expect(SpaceStore.instance.setActiveSpace).toHaveBeenCalledWith(MetaSpace.People);
        });

        it("should render notificationState if one is provided", () => {
            const notificationState = new StaticNotificationState(null, 8, NotificationLevel.Notification);

            const { container, asFragment } = render(
                <SpaceButton
                    spaceKey={MetaSpace.People}
                    selected={true}
                    label="People"
                    data-testid="create-space-button"
                    notificationState={notificationState}
                    size="32px"
                />,
            );

            expect(container.querySelector(".mx_NotificationBadge_count")).toHaveTextContent("8");
            expect(asFragment()).toMatchSnapshot();
        });
    });
});

describe("SpaceItem", () => {
    const cli = stubClient();
    const space = mkRoom(cli, "!1:example.org");
    space.name = "Root Space";
    const subspace = mkRoom(cli, "!2:example.org");
    subspace.name = "Subspace";

    it("should render a space with subspaces", () => {
        mocked(SpaceStore.instance.getChildSpaces).mockImplementation((spaceId) =>
            spaceId === space.roomId ? [subspace] : [],
        );

        const { asFragment, queryByText, getByLabelText } = render(<SpaceItem space={space} activeSpaces={[]} />);

        expect(queryByText("Root Space")).toBeVisible();
        expect(queryByText("Subspace")).toBeNull();
        expect(asFragment()).toMatchSnapshot();

        fireEvent.click(getByLabelText("Expand"));
        expect(queryByText("Root Space")).toBeVisible();
        expect(queryByText("Subspace")).toBeVisible();
        expect(asFragment()).toMatchSnapshot();
    });
});
