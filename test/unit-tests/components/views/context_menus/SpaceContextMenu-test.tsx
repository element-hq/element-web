/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { type Mocked, mocked } from "jest-mock";
import { prettyDOM, render, type RenderResult, screen } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import SpaceContextMenu from "../../../../../src/components/views/context_menus/SpaceContextMenu";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import {
    shouldShowSpaceSettings,
    showCreateNewRoom,
    showCreateNewSubspace,
    showSpaceInvite,
    showSpaceSettings,
} from "../../../../../src/utils/space";
import { leaveSpace } from "../../../../../src/utils/leave-behaviour";
import { shouldShowComponent } from "../../../../../src/customisations/helpers/UIComponents";
import { UIComponent } from "../../../../../src/settings/UIFeature";

jest.mock("../../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

jest.mock("../../../../../src/utils/space", () => ({
    shouldShowSpaceSettings: jest.fn(),
    showCreateNewRoom: jest.fn(),
    showCreateNewSubspace: jest.fn(),
    showSpaceInvite: jest.fn(),
    showSpacePreferences: jest.fn(),
    showSpaceSettings: jest.fn(),
}));

jest.mock("../../../../../src/utils/leave-behaviour", () => ({
    leaveSpace: jest.fn(),
}));

describe("<SpaceContextMenu />", () => {
    const userId = "@test:server";

    const mockClient = {
        getUserId: jest.fn().mockReturnValue(userId),
        getSafeUserId: jest.fn().mockReturnValue(userId),
    } as unknown as Mocked<MatrixClient>;

    const makeMockSpace = (props = {}) =>
        ({
            name: "test space",
            getJoinRule: jest.fn(),
            canInvite: jest.fn(),
            currentState: {
                maySendStateEvent: jest.fn(),
            },
            client: mockClient,
            getMyMembership: jest.fn(),
            ...props,
        }) as unknown as Room;

    const defaultProps = {
        space: makeMockSpace(),
        onFinished: jest.fn(),
    };

    const renderComponent = (props = {}): RenderResult =>
        render(
            <MatrixClientContext.Provider value={mockClient}>
                <SpaceContextMenu {...defaultProps} {...props} />
            </MatrixClientContext.Provider>,
        );

    beforeEach(() => {
        jest.resetAllMocks();
        mockClient.getUserId.mockReturnValue(userId);
        mockClient.getSafeUserId.mockReturnValue(userId);
    });

    it("renders menu correctly", () => {
        const { baseElement } = renderComponent();
        expect(prettyDOM(baseElement)).toMatchSnapshot();
    });

    it("renders invite option when space is public", () => {
        const space = makeMockSpace({
            getJoinRule: jest.fn().mockReturnValue("public"),
        });
        renderComponent({ space });
        expect(screen.getByTestId("invite-option")).toBeInTheDocument();
    });

    it("renders invite option when user is has invite rights for space", () => {
        const space = makeMockSpace({
            canInvite: jest.fn().mockReturnValue(true),
        });
        renderComponent({ space });
        expect(space.canInvite).toHaveBeenCalledWith(userId);
        expect(screen.getByTestId("invite-option")).toBeInTheDocument();
    });

    it("opens invite dialog when invite option is clicked", async () => {
        const space = makeMockSpace({
            getJoinRule: jest.fn().mockReturnValue("public"),
        });
        const onFinished = jest.fn();
        renderComponent({ space, onFinished });

        await userEvent.click(screen.getByTestId("invite-option"));

        expect(showSpaceInvite).toHaveBeenCalledWith(space);
        expect(onFinished).toHaveBeenCalled();
    });

    it("renders space settings option when user has rights", () => {
        mocked(shouldShowSpaceSettings).mockReturnValue(true);
        renderComponent();
        expect(shouldShowSpaceSettings).toHaveBeenCalledWith(defaultProps.space);
        expect(screen.getByTestId("settings-option")).toBeInTheDocument();
    });

    it("opens space settings when space settings option is clicked", async () => {
        mocked(shouldShowSpaceSettings).mockReturnValue(true);
        const onFinished = jest.fn();
        renderComponent({ onFinished });

        await userEvent.click(screen.getByTestId("settings-option"));

        expect(showSpaceSettings).toHaveBeenCalledWith(defaultProps.space);
        expect(onFinished).toHaveBeenCalled();
    });

    it("renders leave option when user does not have rights to see space settings", () => {
        renderComponent();
        expect(screen.getByTestId("leave-option")).toBeInTheDocument();
    });

    it("leaves space when leave option is clicked", async () => {
        const onFinished = jest.fn();
        renderComponent({ onFinished });
        await userEvent.click(screen.getByTestId("leave-option"));
        expect(leaveSpace).toHaveBeenCalledWith(defaultProps.space);
        expect(onFinished).toHaveBeenCalled();
    });

    describe("add children section", () => {
        const space = makeMockSpace();

        beforeEach(() => {
            // set space to allow adding children to space
            mocked(space.currentState.maySendStateEvent).mockReturnValue(true);
            mocked(shouldShowComponent).mockReturnValue(true);
        });

        it("does not render section when user does not have permission to add children", () => {
            mocked(space.currentState.maySendStateEvent).mockReturnValue(false);
            renderComponent({ space });

            expect(screen.queryByTestId("add-to-space-header")).not.toBeInTheDocument();
            expect(screen.queryByTestId("new-room-option")).not.toBeInTheDocument();
            expect(screen.queryByTestId("new-subspace-option")).not.toBeInTheDocument();
        });

        it("does not render section when UIComponent customisations disable room and space creation", () => {
            mocked(shouldShowComponent).mockReturnValue(false);
            renderComponent({ space });

            expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.CreateRooms);
            expect(shouldShowComponent).toHaveBeenCalledWith(UIComponent.CreateSpaces);

            expect(screen.queryByTestId("add-to-space-header")).not.toBeInTheDocument();
            expect(screen.queryByTestId("new-room-option")).not.toBeInTheDocument();
            expect(screen.queryByTestId("new-subspace-option")).not.toBeInTheDocument();
        });

        it("renders section with add room button when UIComponent customisation allows CreateRoom", () => {
            // only allow CreateRoom
            mocked(shouldShowComponent).mockImplementation((feature) => feature === UIComponent.CreateRooms);
            renderComponent({ space });

            expect(screen.getByTestId("add-to-space-header")).toBeInTheDocument();
            expect(screen.getByTestId("new-room-option")).toBeInTheDocument();
            expect(screen.queryByTestId("new-subspace-option")).not.toBeInTheDocument();
        });

        it("renders section with add space button when UIComponent customisation allows CreateSpace", () => {
            // only allow CreateSpaces
            mocked(shouldShowComponent).mockImplementation((feature) => feature === UIComponent.CreateSpaces);
            renderComponent({ space });

            expect(screen.getByTestId("add-to-space-header")).toBeInTheDocument();
            expect(screen.queryByTestId("new-room-option")).not.toBeInTheDocument();
            expect(screen.getByTestId("new-subspace-option")).toBeInTheDocument();
        });

        it("opens create room dialog on add room button click", async () => {
            const onFinished = jest.fn();
            renderComponent({ space, onFinished });

            await userEvent.click(screen.getByTestId("new-room-option"));
            expect(showCreateNewRoom).toHaveBeenCalledWith(space);
            expect(onFinished).toHaveBeenCalled();
        });

        it("opens create space dialog on add space button click", async () => {
            const onFinished = jest.fn();
            renderComponent({ space, onFinished });

            await userEvent.click(screen.getByTestId("new-subspace-option"));
            expect(showCreateNewSubspace).toHaveBeenCalledWith(space);
            expect(onFinished).toHaveBeenCalled();
        });
    });
});
