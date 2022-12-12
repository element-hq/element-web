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
import { render, screen } from "@testing-library/react";
import { EventType, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import fetchMock from "fetch-mock-jest";
import encrypt from "matrix-encrypt-attachment";
import { mocked } from "jest-mock";

import MImageBody from "../../../../src/components/views/messages/MImageBody";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockClientMethodsServer,
    mockClientMethodsUser,
} from "../../../test-utils";
import { MediaEventHelper } from "../../../../src/utils/MediaEventHelper";

jest.mock("matrix-encrypt-attachment", () => ({
    decryptAttachment: jest.fn(),
}));

describe("<MImageBody/>", () => {
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
    const url = "https://server/_matrix/media/r0/download/server/encrypted-image";
    // eslint-disable-next-line no-restricted-properties
    cli.mxcUrlToHttp.mockReturnValue(url);
    const encryptedMediaEvent = new MatrixEvent({
        room_id: "!room:server",
        sender: userId,
        type: EventType.RoomMessage,
        content: {
            file: {
                url: "mxc://server/encrypted-image",
            },
        },
    });
    const props = {
        onHeightChanged: jest.fn(),
        onMessageAllowed: jest.fn(),
        permalinkCreator: new RoomPermalinkCreator(new Room(encryptedMediaEvent.getRoomId(), cli, cli.getUserId())),
    };

    it("should show error when encrypted media cannot be downloaded", async () => {
        fetchMock.getOnce(url, { status: 500 });

        render(
            <MImageBody
                {...props}
                mxEvent={encryptedMediaEvent}
                mediaEventHelper={new MediaEventHelper(encryptedMediaEvent)}
            />,
        );

        await screen.findByText("Error downloading image");
    });

    it("should show error when encrypted media cannot be decrypted", async () => {
        fetchMock.getOnce(url, "thisistotallyanencryptedpng");
        mocked(encrypt.decryptAttachment).mockRejectedValue(new Error("Failed to decrypt"));

        render(
            <MImageBody
                {...props}
                mxEvent={encryptedMediaEvent}
                mediaEventHelper={new MediaEventHelper(encryptedMediaEvent)}
            />,
        );

        await screen.findByText("Error decrypting image");
    });
});
