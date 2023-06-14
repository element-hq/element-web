/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { ComponentProps } from "react";
import { fireEvent, render } from "@testing-library/react";
import { LocationAssetType } from "matrix-js-sdk/src/@types/location";
import { ClientEvent, RoomMember } from "matrix-js-sdk/src/matrix";
import * as maplibregl from "maplibre-gl";
import { logger } from "matrix-js-sdk/src/logger";
import { SyncState } from "matrix-js-sdk/src/sync";

import MLocationBody from "../../../../src/components/views/messages/MLocationBody";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { MediaEventHelper } from "../../../../src/utils/MediaEventHelper";
import Modal from "../../../../src/Modal";
import SdkConfig from "../../../../src/SdkConfig";
import { TILE_SERVER_WK_KEY } from "../../../../src/utils/WellKnownUtils";
import { makeLocationEvent } from "../../../test-utils/location";
import { getMockClientWithEventEmitter } from "../../../test-utils";

// Fake random strings to give a predictable snapshot
jest.mock("matrix-js-sdk/src/randomstring", () => {
    return {
        randomString: () => "abdefghi",
    };
});

describe("MLocationBody", () => {
    const mapOptions = { container: {} as unknown as HTMLElement, style: "" };
    describe("<MLocationBody>", () => {
        const roomId = "!room:server";
        const userId = "@user:server";
        const mockClient = getMockClientWithEventEmitter({
            getClientWellKnown: jest.fn().mockReturnValue({
                [TILE_SERVER_WK_KEY.name]: { map_style_url: "maps.com" },
            }),
            isGuest: jest.fn().mockReturnValue(false),
        });
        const defaultEvent = makeLocationEvent("geo:51.5076,-0.1276", LocationAssetType.Pin);
        const defaultProps: ComponentProps<typeof MLocationBody> = {
            mxEvent: defaultEvent,
            highlights: [],
            highlightLink: "",
            onHeightChanged: jest.fn(),
            onMessageAllowed: jest.fn(),
            permalinkCreator: {} as RoomPermalinkCreator,
            mediaEventHelper: {} as MediaEventHelper,
        };
        const getComponent = (props = {}) =>
            render(
                <MatrixClientContext.Provider value={mockClient}>
                    <MLocationBody {...defaultProps} {...props} />
                </MatrixClientContext.Provider>,
            );
        const getMapErrorComponent = () => {
            const mockMap = new maplibregl.Map(mapOptions);
            mockClient.getClientWellKnown.mockReturnValue({
                [TILE_SERVER_WK_KEY.name]: { map_style_url: "bad-tile-server.com" },
            });
            const component = getComponent();

            // simulate error initialising map in maplibregl
            // @ts-ignore
            mockMap.emit("error", { status: 404 });

            return component;
        };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        describe("with error", () => {
            let sdkConfigSpy: jest.SpyInstance<any>;

            beforeEach(() => {
                // eat expected errors to keep console clean
                jest.spyOn(logger, "error").mockImplementation(() => {});
                mockClient.getClientWellKnown.mockReturnValue({});
                sdkConfigSpy = jest.spyOn(SdkConfig, "get").mockReturnValue({});
            });

            afterAll(() => {
                sdkConfigSpy.mockRestore();
                jest.spyOn(logger, "error").mockRestore();
            });

            it("displays correct fallback content without error style when map_style_url is not configured", () => {
                const component = getComponent();
                expect(component.container.querySelector(".mx_EventTile_body")).toMatchSnapshot();
            });

            it("displays correct fallback content when map_style_url is misconfigured", () => {
                const component = getMapErrorComponent();
                expect(component.container.querySelector(".mx_EventTile_body")).toMatchSnapshot();
            });

            it("should clear the error on reconnect", () => {
                const component = getMapErrorComponent();
                expect(component.container.querySelector(".mx_EventTile_tileError")).toBeDefined();
                mockClient.emit(ClientEvent.Sync, SyncState.Reconnecting, SyncState.Error);
                expect(component.container.querySelector(".mx_EventTile_tileError")).toBeFalsy();
            });
        });

        describe("without error", () => {
            beforeEach(() => {
                mockClient.getClientWellKnown.mockReturnValue({
                    [TILE_SERVER_WK_KEY.name]: { map_style_url: "maps.com" },
                });

                // MLocationBody uses random number for map id
                // stabilise for test
                jest.spyOn(global.Math, "random").mockReturnValue(0.123456);
            });

            afterAll(() => {
                jest.spyOn(global.Math, "random").mockRestore();
            });

            it("renders map correctly", () => {
                const mockMap = new maplibregl.Map(mapOptions);
                const component = getComponent();

                expect(component.asFragment()).toMatchSnapshot();
                // map was centered
                expect(mockMap.setCenter).toHaveBeenCalledWith({
                    lat: 51.5076,
                    lon: -0.1276,
                });
            });

            it("opens map dialog on click", async () => {
                const modalSpy = jest
                    .spyOn(Modal, "createDialog")
                    .mockReturnValue({ finished: new Promise(() => {}), close: jest.fn() });
                const component = getComponent();

                await fireEvent.click(component.container.querySelector(".mx_Map")!);

                expect(modalSpy).toHaveBeenCalled();
            });

            it("renders marker correctly for a self share", () => {
                const selfShareEvent = makeLocationEvent("geo:51.5076,-0.1276", LocationAssetType.Self);
                const member = new RoomMember(roomId, userId);
                // @ts-ignore cheat assignment to property
                selfShareEvent.sender = member;
                const component = getComponent({ mxEvent: selfShareEvent });

                // render self locations with user avatars
                expect(component.asFragment()).toMatchSnapshot();
            });
        });
    });
});
