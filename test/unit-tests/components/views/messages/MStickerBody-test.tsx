/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";
import { EventType, getHttpUriForMxc, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import fetchMock from "fetch-mock-jest";
import userEvent from "@testing-library/user-event";

import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockClientMethodsServer,
    mockClientMethodsUser,
} from "../../../../test-utils";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import MStickerBody from "../../../../../src/components/views/messages/MStickerBody";

describe("<MStickerBody/>", () => {
    const userId = "@user:server";
    const deviceId = "DEADB33F";
    const cli = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        ...mockClientMethodsDevice(deviceId),
        ...mockClientMethodsCrypto(),
        getRooms: jest.fn().mockReturnValue([]),
        getIgnoredUsers: jest.fn(),
        getVersions: jest.fn().mockResolvedValue({
            unstable_features: {
                "org.matrix.msc3882": true,
                "org.matrix.msc3886": true,
            },
        }),
    });
    const url = "https://server/_matrix/media/v3/download/server/sticker";
    // eslint-disable-next-line no-restricted-properties
    cli.mxcUrlToHttp.mockImplementation(
        (mxcUrl: string, width?: number, height?: number, resizeMethod?: string, allowDirectLinks?: boolean) => {
            return getHttpUriForMxc("https://server", mxcUrl, width, height, resizeMethod, allowDirectLinks);
        },
    );
    const mediaEvent = new MatrixEvent({
        room_id: "!room:server",
        sender: userId,
        type: EventType.RoomMessage,
        content: {
            body: "sticker description",
            info: {
                w: 40,
                h: 50,
            },
            file: {
                url: "mxc://server/sticker",
            },
        },
    });

    const props = {
        onMessageAllowed: jest.fn(),
        permalinkCreator: new RoomPermalinkCreator(new Room(mediaEvent.getRoomId()!, cli, cli.getUserId()!)),
    };

    beforeEach(() => {
        jest.spyOn(SettingsStore, "getValue").mockRestore();
        fetchMock.mockReset();
    });

    it("should show a tooltip on hover", async () => {
        fetchMock.getOnce(url, { status: 200 });

        render(<MStickerBody {...props} mxEvent={mediaEvent} />);

        expect(screen.queryByRole("tooltip")).toBeNull();
        await userEvent.hover(screen.getByRole("img"));
        await expect(screen.findByRole("tooltip")).resolves.toHaveTextContent("sticker description");
    });
});
