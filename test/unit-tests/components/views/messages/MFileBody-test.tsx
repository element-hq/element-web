/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { EventType, getHttpUriForMxc, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockClientMethodsServer,
    mockClientMethodsUser,
} from "../../../../test-utils";
import { MediaEventHelper } from "../../../../../src/utils/MediaEventHelper";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import MFileBody from "../../../../../src/components/views/messages/MFileBody.tsx";
import { TimelineRenderingType } from "../../../../../src/contexts/RoomContext.ts";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";

jest.mock("matrix-encrypt-attachment", () => ({
    decryptAttachment: jest.fn(),
}));

describe("<MFileBody/>", () => {
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
            body: "alt for a image",
            msgtype: "m.image",
            url: "mxc://server/image",
        },
    });

    const props = {
        onMessageAllowed: jest.fn(),
        permalinkCreator: new RoomPermalinkCreator(new Room(mediaEvent.getRoomId()!, cli, cli.getUserId()!)),
    };

    beforeEach(() => {
        jest.spyOn(SettingsStore, "getValue").mockRestore();
    });

    it("should show a download button in file rendering type", async () => {
        const { container, getByRole } = render(
            <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.File } as any)}>
                <MFileBody
                    {...props}
                    mxEvent={mediaEvent}
                    mediaEventHelper={new MediaEventHelper(mediaEvent)}
                    showGenericPlaceholder={false}
                />
            </ScopedRoomContextProvider>,
        );

        expect(getByRole("link", { name: "Download" })).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
