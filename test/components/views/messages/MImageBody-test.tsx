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
import { fireEvent, render, screen } from "@testing-library/react";
import { EventType, getHttpUriForMxc, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
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
import SettingsStore from "../../../../src/settings/SettingsStore";

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
            body: "alt for a test image",
            info: {
                w: 40,
                h: 50,
            },
            file: {
                url: "mxc://server/encrypted-image",
            },
        },
    });

    const props = {
        onHeightChanged: jest.fn(),
        onMessageAllowed: jest.fn(),
        permalinkCreator: new RoomPermalinkCreator(new Room(encryptedMediaEvent.getRoomId()!, cli, cli.getUserId()!)),
    };

    beforeEach(() => {
        jest.spyOn(SettingsStore, "getValue").mockRestore();
        fetchMock.mockReset();
    });

    it("should show a thumbnail while image is being downloaded", async () => {
        fetchMock.getOnce(url, { status: 200 });

        const { container } = render(
            <MImageBody
                {...props}
                mxEvent={encryptedMediaEvent}
                mediaEventHelper={new MediaEventHelper(encryptedMediaEvent)}
            />,
        );

        // thumbnail with dimensions present
        expect(container).toMatchSnapshot();
    });

    it("should show error when encrypted media cannot be downloaded", async () => {
        fetchMock.getOnce(url, { status: 500 });

        render(
            <MImageBody
                {...props}
                mxEvent={encryptedMediaEvent}
                mediaEventHelper={new MediaEventHelper(encryptedMediaEvent)}
            />,
        );

        expect(fetchMock).toHaveBeenCalledWith(url);

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

    describe("with image previews/thumbnails disabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        });

        it("should not download image", async () => {
            fetchMock.getOnce(url, { status: 200 });

            render(
                <MImageBody
                    {...props}
                    mxEvent={encryptedMediaEvent}
                    mediaEventHelper={new MediaEventHelper(encryptedMediaEvent)}
                />,
            );

            expect(fetchMock).not.toHaveFetched(url);
        });

        it("should render hidden image placeholder", async () => {
            fetchMock.getOnce(url, { status: 200 });

            render(
                <MImageBody
                    {...props}
                    mxEvent={encryptedMediaEvent}
                    mediaEventHelper={new MediaEventHelper(encryptedMediaEvent)}
                />,
            );

            expect(screen.getByText("Show image")).toBeInTheDocument();

            fireEvent.click(screen.getByRole("button"));

            // image fetched after clicking show image
            expect(fetchMock).toHaveFetched(url);

            // spinner while downloading image
            expect(screen.getByRole("progressbar")).toBeInTheDocument();
        });
    });

    it("should fall back to /download/ if /thumbnail/ fails", async () => {
        const thumbUrl = "https://server/_matrix/media/r0/thumbnail/server/image?width=800&height=600&method=scale";
        const downloadUrl = "https://server/_matrix/media/r0/download/server/image";
        // eslint-disable-next-line no-restricted-properties
        cli.mxcUrlToHttp.mockImplementation(
            (mxcUrl: string, width?: number, height?: number, resizeMethod?: string, allowDirectLinks?: boolean) => {
                return getHttpUriForMxc("https://server", mxcUrl, width, height, resizeMethod, allowDirectLinks);
            },
        );

        const event = new MatrixEvent({
            room_id: "!room:server",
            sender: userId,
            type: EventType.RoomMessage,
            content: {
                body: "alt for a test image",
                info: {
                    w: 40,
                    h: 50,
                },
                url: "mxc://server/image",
            },
        });

        const { container } = render(
            <MImageBody {...props} mxEvent={event} mediaEventHelper={new MediaEventHelper(event)} />,
        );

        const img = container.querySelector(".mx_MImageBody_thumbnail")!;
        expect(img).toHaveProperty("src", thumbUrl);

        fireEvent.error(img);
        expect(img).toHaveProperty("src", downloadUrl);
    });
});
