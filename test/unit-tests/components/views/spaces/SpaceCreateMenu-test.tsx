/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, cleanup } from "jest-matrix-react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";
import { MatrixError } from "matrix-js-sdk/src/matrix";
import { type MockedObject } from "jest-mock";

import SpaceCreateMenu from "../../../../../src/components/views/spaces/SpaceCreateMenu";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsRooms,
    mockClientMethodsServer,
    mockClientMethodsUser,
    withClientContextRenderOptions,
} from "../../../../test-utils";
import { UIFeature } from "../../../../../src/settings/UIFeature";
import SettingsStore from "../../../../../src/settings/SettingsStore";

describe("<SpaceCreateMenu />", () => {
    let client: MockedObject<MatrixClient>;

    beforeEach(() => {
        client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(),
            ...mockClientMethodsServer(),
            ...mockClientMethodsRooms(),
            createRoom: jest.fn(),
            getRoomIdForAlias: jest.fn().mockImplementation(async () => {
                throw new MatrixError({ errcode: "M_NOT_FOUND", error: "Test says no alias found" }, 404);
            }),
        });
    });

    afterEach(() => {
        cleanup();
        jest.restoreAllMocks();
    });

    it("should render", async () => {
        const { asFragment } = render(
            <SpaceCreateMenu onFinished={jest.fn()} />,
            withClientContextRenderOptions(client),
        );
        expect(asFragment()).toMatchSnapshot();
    });

    it("should be able to create a public space", async () => {
        const onFinished = jest.fn();
        client.createRoom.mockResolvedValue({ room_id: "!room:id" });
        const { getByText, getByLabelText } = render(
            <SpaceCreateMenu onFinished={onFinished} />,
            withClientContextRenderOptions(client),
        );
        await userEvent.click(getByText("Public"));
        await userEvent.type(getByLabelText("Name"), "My Name");
        await userEvent.type(getByLabelText("Address"), "foobar");
        await userEvent.type(getByLabelText("Description"), "A description");
        await userEvent.click(getByText("Create"));
        expect(onFinished).toHaveBeenCalledTimes(1);
        expect(client.createRoom).toHaveBeenCalledWith({
            creation_content: { type: "m.space" },
            initial_state: [
                { content: { guest_access: "can_join" }, state_key: "", type: "m.room.guest_access" },
                { content: { history_visibility: "world_readable" }, type: "m.room.history_visibility" },
            ],
            name: "My Name",
            power_level_content_override: {
                events_default: 100,
                invite: 0,
            },
            preset: "public_chat",
            room_alias_name: "my-namefoobar",
            topic: "A description",
            visibility: "private",
        });
    });

    it("should be prompted to automatically create a private space when configured", async () => {
        const realGetValue = SettingsStore.getValue;
        jest.spyOn(SettingsStore, "getValue").mockImplementation((name, roomId) => {
            if (name === UIFeature.AllowCreatingPublicSpaces) {
                return false;
            }
            return realGetValue(name, roomId);
        });
        const onFinished = jest.fn();
        client.createRoom.mockResolvedValue({ room_id: "!room:id" });
        const { getByText, getByLabelText } = render(
            <SpaceCreateMenu onFinished={onFinished} />,
            withClientContextRenderOptions(client),
        );
        await userEvent.type(getByLabelText("Name"), "My Name");
        await userEvent.type(getByLabelText("Description"), "A description");
        await userEvent.click(getByText("Create"));
        expect(onFinished).toHaveBeenCalledTimes(1);
        expect(client.createRoom).toHaveBeenCalledWith({
            creation_content: { type: "m.space" },
            initial_state: [
                { content: { guest_access: "can_join" }, state_key: "", type: "m.room.guest_access" },
                { content: { history_visibility: "invited" }, type: "m.room.history_visibility" },
            ],
            name: "My Name",
            power_level_content_override: {
                events_default: 100,
                invite: 50,
            },
            room_alias_name: undefined,
            preset: "private_chat",
            topic: "A description",
            visibility: "private",
        });
    });
});
