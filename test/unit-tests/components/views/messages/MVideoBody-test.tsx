/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { act } from "react";
import { EventType, getHttpUriForMxc, type IContent, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { fireEvent, render, screen, type RenderResult } from "jest-matrix-react";
import fetchMock from "fetch-mock-jest";

import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { type RoomPermalinkCreator } from "../../../../../src/utils/permalinks/Permalinks";
import { MediaEventHelper } from "../../../../../src/utils/MediaEventHelper";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockClientMethodsServer,
    mockClientMethodsUser,
} from "../../../../test-utils";
import MVideoBody from "../../../../../src/components/views/messages/MVideoBody";
import type { IBodyProps } from "../../../../../src/components/views/messages/IBodyProps";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";
import SettingsStore from "../../../../../src/settings/SettingsStore";

// Needed so we don't throw an error about failing to decrypt.
jest.mock("matrix-encrypt-attachment", () => ({
    decryptAttachment: jest.fn(),
}));

describe("MVideoBody", () => {
    const userId = "@user:server";
    const deviceId = "DEADB33F";

    const thumbUrl = "https://server/_matrix/media/v3/download/server/encrypted-poster";

    beforeEach(() => {
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
        fetchMock.mockReset();
    });

    const encryptedMediaEvent = new MatrixEvent({
        room_id: "!room:server",
        sender: userId,
        type: EventType.RoomMessage,
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

    it("does not crash when given a portrait image", () => {
        // Check for an unreliable crash caused by a fractional-sized
        // image dimension being used for a CanvasImageData.
        const { asFragment } = makeMVideoBody(720, 1280);
        expect(asFragment()).toMatchSnapshot();
        // If we get here, we did not crash.
    });

    it("should show poster for encrypted media before downloading it", async () => {
        fetchMock.getOnce(thumbUrl, { status: 200 });
        const { asFragment } = render(
            <MVideoBody mxEvent={encryptedMediaEvent} mediaEventHelper={new MediaEventHelper(encryptedMediaEvent)} />,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    describe("with video previews/thumbnails disabled", () => {
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

        it("should not download video", async () => {
            fetchMock.getOnce(thumbUrl, { status: 200 });

            render(
                <MVideoBody
                    mxEvent={encryptedMediaEvent}
                    mediaEventHelper={new MediaEventHelper(encryptedMediaEvent)}
                />,
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
            );

            const placeholderButton = screen.getByRole("button", { name: "Show video" });

            expect(placeholderButton).toBeInTheDocument();
            fireEvent.click(placeholderButton);

            expect(fetchMock).toHaveFetched(thumbUrl);
        });
    });
});

function makeMVideoBody(w: number, h: number): RenderResult {
    const content: IContent = {
        info: {
            "w": w,
            "h": h,
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

    const mockClient = getMockClientWithEventEmitter({
        mxcUrlToHttp: jest.fn(),
    });

    return render(
        <MatrixClientContext.Provider value={mockClient}>
            <MVideoBody {...defaultProps} />
        </MatrixClientContext.Provider>,
    );
}
