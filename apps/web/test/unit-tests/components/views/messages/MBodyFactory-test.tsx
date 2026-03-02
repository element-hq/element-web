/*
Copyright 2026 Element Creations Ltd.

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
import { MFileBodyViewFactory, renderMBody } from "../../../../../src/components/views/messages/MBodyFactory";
import { TimelineRenderingType } from "../../../../../src/contexts/RoomContext.ts";
import { ScopedRoomContextProvider } from "../../../../../src/contexts/ScopedRoomContext.tsx";

jest.mock("matrix-encrypt-attachment", () => ({
    decryptAttachment: jest.fn(),
}));

describe("MBodyFactory", () => {
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

    const props = {
        onMessageAllowed: jest.fn(),
        permalinkCreator: new RoomPermalinkCreator(new Room("!room:server", cli, cli.getUserId()!)),
    };
    const mkEvent = (msgtype?: string): MatrixEvent =>
        new MatrixEvent({
            room_id: "!room:server",
            sender: userId,
            type: EventType.RoomMessage,
            content: {
                body: "alt",
                ...(msgtype ? { msgtype } : {}),
                url: "mxc://server/file",
            },
        });

    beforeEach(() => {
        jest.spyOn(SettingsStore, "getValue").mockRestore();
    });

    describe("renderMBody", () => {
        it("renders download button for m.file in file rendering type", () => {
            const mediaEvent = mkEvent("m.file");

            const { container, getByRole } = render(
                <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.File } as any)}>
                    {renderMBody({
                        ...props,
                        mxEvent: mediaEvent,
                        mediaEventHelper: new MediaEventHelper(mediaEvent),
                        showFileInfo: false,
                    })}
                </ScopedRoomContextProvider>,
            );

            expect(getByRole("link", { name: "Download" })).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });

        it.each(["m.audio", "m.video", "m.text"])("returns null for unsupported msgtype %s", (msgtype) => {
            expect(renderMBody({ ...props, mxEvent: mkEvent(msgtype) })).toBeNull();
        });

        it("returns null when msgtype is missing", () => {
            expect(renderMBody({ ...props, mxEvent: mkEvent() })).toBeNull();
        });

        it("falls back to file body for unsupported msgtypes", () => {
            const mediaEvent = mkEvent("m.audio");
            const { getByRole } = render(
                <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.File } as any)}>
                    {renderMBody(
                        {
                            ...props,
                            mxEvent: mediaEvent,
                            mediaEventHelper: new MediaEventHelper(mediaEvent),
                        },
                        MFileBodyViewFactory,
                    )}
                </ScopedRoomContextProvider>,
            );
            expect(getByRole("button", { name: "alt" })).toBeInTheDocument();
        });
    });

    it.each(["m.file", "m.audio", "m.video"])(
        "renderMBody fallback shows %s generic placeholder when showFileInfo is true",
        async (msgtype) => {
            const mediaEvent = new MatrixEvent({
                room_id: "!room:server",
                sender: userId,
                type: EventType.RoomMessage,
                content: {
                    body: "alt",
                    msgtype,
                    url: "mxc://server/image",
                },
            });

            const { container, getByRole } = render(
                <ScopedRoomContextProvider {...({ timelineRenderingType: TimelineRenderingType.File } as any)}>
                    {renderMBody(
                        {
                            ...props,
                            mxEvent: mediaEvent,
                            mediaEventHelper: new MediaEventHelper(mediaEvent),
                            showFileInfo: true,
                        },
                        MFileBodyViewFactory,
                    )}
                </ScopedRoomContextProvider>,
            );

            expect(getByRole("button", { name: "alt" })).toBeInTheDocument();
            expect(container).toMatchSnapshot();
        },
    );
});
