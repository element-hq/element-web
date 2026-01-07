/*
Copyright 2024, 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { EventType, getHttpUriForMxc, type IContent, type MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { fireEvent, render, screen } from "jest-matrix-react";
import fetchMock from "fetch-mock-jest";
import { type MockedObject } from "jest-mock";

import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { type RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import { MediaEventHelper } from "../../../../../src/utils/MediaEventHelper";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockClientMethodsServer,
    mockClientMethodsUser,
    withClientContextRenderOptions,
} from "../../../../test-utils";
import MVideoBody from "../../../../../src/components/views/messages/MVideoBody";
import type { IBodyProps } from "../../../../../src/components/views/messages/IBodyProps";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { MediaPreviewValue } from "../../../../../src/@types/media_preview";

// Needed so we don't throw an error about failing to decrypt.
jest.mock("matrix-encrypt-attachment", () => ({
    decryptAttachment: jest.fn(),
}));

describe("MVideoBody", () => {
    const ourUserId = "@user:server";
    const senderUserId = "@other_use:server";
    const deviceId = "DEADB33F";

    const thumbUrl = "https://server/_matrix/media/v3/download/server/encrypted-poster";
    let cli: MockedObject<MatrixClient>;

    beforeEach(() => {
        cli = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(ourUserId),
            ...mockClientMethodsServer(),
            ...mockClientMethodsDevice(deviceId),
            ...mockClientMethodsCrypto(),
            getRoom: jest.fn(),
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
        fetchMock.mockReset();
    });

    const encryptedMediaEvent = new MatrixEvent({
        room_id: "!room:server",
        sender: senderUserId,
        type: EventType.RoomMessage,
        event_id: "$foo:bar",
        content: {
            body: "alt for a test video",
            info: {
                duration: 420,
                w: 40,
                h: 50,
                thumbnail_file: {
                    url: "mxc://server/encrypted-poster",
                },
            },
            file: {
                url: "mxc://server/encrypted-image",
            },
        },
    });

    it("does not crash when given portrait dimensions", () => {
        // Check for an unreliable crash caused by a fractional-sized
        // image dimension being used for a CanvasImageData.
        const content: IContent = {
            info: {
                "w": 720,
                "h": 1280,
                "mimetype": "video/mp4",
                "size": 2495675,
                "thumbnail_file": {
                    url: "",
                    key: { alg: "", key_ops: [], kty: "", k: "", ext: true },
                    iv: "",
                    hashes: {},
                    v: "",
                },
                "thumbnail_info": { mimetype: "" },
                "xyz.amorgan.blurhash": "TrGl6bofof~paxWC?bj[oL%2fPj]",
            },
            url: "http://example.com",
        };

        const event = new MatrixEvent({
            content,
        });

        const defaultProps: IBodyProps = {
            mxEvent: event,
            highlights: [],
            highlightLink: "",
            onMessageAllowed: jest.fn(),
            permalinkCreator: {} as RoomPermalinkCreator,
            mediaEventHelper: { media: { isEncrypted: false } } as MediaEventHelper,
        };

        const { asFragment } = render(
            <MatrixClientContext.Provider value={cli}>
                <MVideoBody {...defaultProps} />
            </MatrixClientContext.Provider>,
            withClientContextRenderOptions(cli),
        );
        expect(asFragment()).toMatchSnapshot();
        // If we get here, we did not crash.
    });

    it("should show poster for encrypted media before downloading it", async () => {
        fetchMock.getOnce(thumbUrl, { status: 200 });
        const { asFragment } = render(
            <MVideoBody mxEvent={encryptedMediaEvent} mediaEventHelper={new MediaEventHelper(encryptedMediaEvent)} />,
            withClientContextRenderOptions(cli),
        );
        expect(asFragment()).toMatchSnapshot();
    });

    describe("with video previews/thumbnails disabled", () => {
        beforeEach(() => {
            const origFn = SettingsStore.getValue;
            jest.spyOn(SettingsStore, "getValue").mockImplementation((setting, ...args) => {
                if (setting === "mediaPreviewConfig") {
                    return { invite_avatars: MediaPreviewValue.Off, media_previews: MediaPreviewValue.Off };
                }
                return origFn(setting, ...args);
            });
        });

        afterEach(() => {
            SettingsStore.reset();
            jest.restoreAllMocks();
        });

        it("should not download video", async () => {
            fetchMock.getOnce(thumbUrl, { status: 200 });

            render(
                <MVideoBody
                    mxEvent={encryptedMediaEvent}
                    mediaEventHelper={new MediaEventHelper(encryptedMediaEvent)}
                />,
                withClientContextRenderOptions(cli),
            );

            expect(screen.getByText("Show video")).toBeInTheDocument();

            expect(fetchMock).not.toHaveFetched(thumbUrl);
        });

        it("should render video poster after user consent", async () => {
            fetchMock.getOnce(thumbUrl, { status: 200 });

            render(
                <MVideoBody
                    mxEvent={encryptedMediaEvent}
                    mediaEventHelper={new MediaEventHelper(encryptedMediaEvent)}
                />,
                withClientContextRenderOptions(cli),
            );

            const placeholderButton = screen.getByRole("button", { name: "Show video" });

            expect(placeholderButton).toBeInTheDocument();
            fireEvent.click(placeholderButton);

            expect(fetchMock).toHaveFetched(thumbUrl);
        });

        it("should download video if we were the sender", async () => {
            fetchMock.getOnce(thumbUrl, { status: 200 });
            const ourEncryptedMediaEvent = new MatrixEvent({
                room_id: "!room:server",
                sender: ourUserId,
                type: EventType.RoomMessage,
                event_id: "$foo:bar",
                content: {
                    body: "alt for a test video",
                    info: {
                        duration: 420,
                        w: 40,
                        h: 50,
                        thumbnail_file: {
                            url: "mxc://server/encrypted-poster",
                        },
                    },
                    file: {
                        url: "mxc://server/encrypted-image",
                    },
                },
            });
            const { asFragment } = render(
                <MVideoBody
                    mxEvent={ourEncryptedMediaEvent}
                    mediaEventHelper={new MediaEventHelper(ourEncryptedMediaEvent)}
                />,
                withClientContextRenderOptions(cli),
            );

            expect(fetchMock).toHaveFetched(thumbUrl);
            expect(asFragment()).toMatchSnapshot();
        });
    });
});
