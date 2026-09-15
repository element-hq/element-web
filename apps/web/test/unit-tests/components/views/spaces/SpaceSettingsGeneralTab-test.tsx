/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen, waitFor } from "jest-matrix-react";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import SpaceSettingsGeneralTab from "../../../../../src/components/views/spaces/SpaceSettingsGeneralTab";
import { stubClient } from "../../../../test-utils";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";

describe("<SpaceSettingsGeneralTab />", () => {
    let client: MatrixClient;
    let space: Room;

    const AVATAR_SELECTOR = "img.mx_SpaceBasicSettings_avatar";

    beforeEach(() => {
        client = stubClient();
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(new DMRoomMap(client));
        space = new Room("!space:example.com", client, client.getSafeUserId());
        space.name = "Test space";
        jest.spyOn(space.currentState, "maySendStateEvent").mockReturnValue(true);
    });

    const renderTab = (): ReturnType<typeof render> =>
        render(<SpaceSettingsGeneralTab matrixClient={client} space={space} />);

    const chooseAvatar = async (container: HTMLElement): Promise<void> => {
        const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!;
        fireEvent.change(fileInput, {
            target: { files: [new File(["avatar"], "avatar.png", { type: "image/png" })] },
        });
        await waitFor(() => expect(container.querySelector(AVATAR_SELECTOR)).toBeInTheDocument());
    };

    it("should discard a chosen avatar when the changes are cancelled", async () => {
        const { container } = renderTab();

        // Guard: the space has no avatar, so anything shown afterwards is the user's choice.
        expect(container.querySelector(AVATAR_SELECTOR)).toBeNull();

        await chooseAvatar(container);

        fireEvent.click(screen.getByText("Cancel"));

        expect(container.querySelector(AVATAR_SELECTOR)).toBeNull();
    });

    it("should keep a chosen avatar until the changes are cancelled", async () => {
        const { container } = renderTab();

        await chooseAvatar(container);

        expect(container.querySelector(AVATAR_SELECTOR)).toBeInTheDocument();
    });
});
