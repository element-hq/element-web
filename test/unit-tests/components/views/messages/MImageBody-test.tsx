/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { act } from "react";
import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from "jest-matrix-react";
import { EventType, getHttpUriForMxc, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import fetchMock from "fetch-mock-jest";
import encrypt from "matrix-encrypt-attachment";
import { mocked } from "jest-mock";
import fs from "fs";
import path from "path";
import userEvent from "@testing-library/user-event";

import MImageBody from "../../../../../src/components/views/messages/MImageBody";
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
import { SettingLevel } from "../../../../../src/settings/SettingLevel";

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
    const url = "https://server/_matrix/media/v3/download/server/encrypted-image";
    // eslint-disable-next-line no-restricted-properties
    cli.mxcUrlToHttp.mockImplementation(
        (mxcUrl: string, width?: number, height?: number, resizeMethod?: string, allowDirectLinks?: boolean) => {
            return getHttpUriForMxc("https://server", mxcUrl, width, height, resizeMethod, allowDirectLinks);
        },
    );
    const encryptedMediaEvent = new MatrixEvent({
        event_id: "$foo:bar",
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
        onMessageAllowed: jest.fn(),
        permalinkCreator: new RoomPermalinkCreator(new Room(encryptedMediaEvent.getRoomId()!, cli, cli.getUserId()!)),
    };

    beforeEach(() => {
        jest.spyOn(SettingsStore, "getValue").mockRestore();
        fetchMock.mockReset();
    });

    afterEach(() => {
        mocked(encrypt.decryptAttachment).mockReset();
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
            act(() => {
                SettingsStore.setValue("showImages", null, SettingLevel.DEVICE, false);
            });
        });

        afterEach(() => {
            act(() => {
                SettingsStore.setValue(
                    "showImages",
                    null,
                    SettingLevel.DEVICE,
                    SettingsStore.getDefaultValue("showImages"),
                );
                SettingsStore.setValue(
                    "showMediaEventIds",
                    null,
                    SettingLevel.DEVICE,
                    SettingsStore.getDefaultValue("showMediaEventIds"),
                );
            });
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

            expect(screen.getByText("Show image")).toBeInTheDocument();

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

            expect(fetchMock).toHaveFetched(url);

            // Show image is asynchronous since it applies through a settings watcher hook, so
            // be sure to wait here.
            await waitFor(() => {
                // spinner while downloading image
                expect(screen.getByRole("progressbar")).toBeInTheDocument();
            });
        });
    });

    it("should fall back to /download/ if /thumbnail/ fails", async () => {
        const thumbUrl = "https://server/_matrix/media/v3/thumbnail/server/image?width=800&height=600&method=scale";
        const downloadUrl = "https://server/_matrix/media/v3/download/server/image";

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

    it("should generate a thumbnail if one isn't included for animated media", async () => {
        Object.defineProperty(global.Image.prototype, "src", {
            set(src) {
                window.setTimeout(() => this.onload?.());
            },
        });
        Object.defineProperty(global.Image.prototype, "height", {
            get() {
                return 600;
            },
        });
        Object.defineProperty(global.Image.prototype, "width", {
            get() {
                return 800;
            },
        });

        mocked(global.URL.createObjectURL).mockReturnValue("blob:generated-thumb");

        fetchMock.getOnce(
            "https://server/_matrix/media/v3/download/server/image",
            {
                body: fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "images", "animated-logo.webp")),
            },
            { sendAsJson: false },
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
                    mimetype: "image/webp",
                },
                url: "mxc://server/image",
            },
        });

        const { container } = render(
            <MImageBody {...props} mxEvent={event} mediaEventHelper={new MediaEventHelper(event)} />,
        );

        // Wait for spinners to go away
        await waitForElementToBeRemoved(screen.getAllByRole("progressbar"));
        // thumbnail with dimensions present
        expect(container).toMatchSnapshot();
    });

    it("should show banner on hover", async () => {
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
        await userEvent.hover(img);

        expect(container.querySelector(".mx_MImageBody_banner")).toHaveTextContent("...alt for a test image");
    });
});
