/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, afterAll, vi, type MockInstance } from "vitest";
import { fireEvent, render, waitFor } from "test-utils-rtl";
import * as maplibregl from "maplibre-gl";
import { LocationAssetType, ClientEvent, RoomMember, SyncState } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { sleep } from "matrix-js-sdk/src/utils";
import { makeLocationEvent, getMockClientWithEventEmitter } from "test-utils";

import MLocationBody from "./MLocationBody";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { type MediaEventHelper } from "../../../utils/MediaEventHelper";
import Modal from "../../../Modal";
import SdkConfig from "../../../SdkConfig";
import { TILE_SERVER_WK_KEY } from "../../../utils/WellKnownUtils";

vi.mock("maplibre-gl");

describe("MLocationBody", () => {
    describe("<MLocationBody>", () => {
        const roomId = "!room:server";
        const userId = "@user:server";
        const mockMapInstance = new maplibregl.Map({ container: {} as unknown as HTMLElement, style: "" });
        const mockClient = getMockClientWithEventEmitter({
            getClientWellKnown: vi.fn().mockReturnValue({
                [TILE_SERVER_WK_KEY.name]: { map_style_url: "maps.com" },
            }),
            isGuest: vi.fn().mockReturnValue(false),
        });
        const defaultEvent = makeLocationEvent("geo:51.5076,-0.1276", LocationAssetType.Pin);
        const defaultProps: MLocationBody["props"] = {
            mxEvent: defaultEvent,
            highlights: [],
            highlightLink: "",
            onMessageAllowed: vi.fn(),
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
            mockClient.getClientWellKnown.mockReturnValue({
                [TILE_SERVER_WK_KEY.name]: { map_style_url: "bad-tile-server.com" },
            });
            const component = getComponent();

            sleep(10).then(() => {
                // simulate error initialising map in maplibregl
                // @ts-ignore
                mockMapInstance.emit("error", { status: 404 });
            });

            return component;
        };

        beforeEach(() => {
            vi.clearAllMocks();
        });

        describe("with error", () => {
            let sdkConfigSpy: MockInstance;

            beforeEach(() => {
                // eat expected errors to keep console clean
                vi.spyOn(logger, "error").mockImplementation(() => {});
                mockClient.getClientWellKnown.mockReturnValue({});
                sdkConfigSpy = vi.spyOn(SdkConfig, "get").mockReturnValue({});
            });

            afterAll(() => {
                sdkConfigSpy.mockRestore();
                vi.spyOn(logger, "error").mockRestore();
            });

            it("displays correct fallback content without error style when map_style_url is not configured", async () => {
                const component = getComponent();

                // The map code needs to be lazy loaded so this will take some time to appear
                await waitFor(() =>
                    expect(component.container.querySelector(".mx_EventTile_body")).toBeInTheDocument(),
                );
                expect(component.container.querySelector(".mx_EventTile_body")).toMatchSnapshot();
            });

            it("displays correct fallback content when map_style_url is misconfigured", async () => {
                const component = getMapErrorComponent();
                await waitFor(() => expect(component.container.querySelector(".mx_EventTile_body")).toBeTruthy());
                await waitFor(() => expect(component.container.querySelector(".mx_EventTile_body")).toMatchSnapshot());
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
                vi.spyOn(global.Math, "random").mockReturnValue(0.123456);
            });

            afterAll(() => {
                vi.spyOn(global.Math, "random").mockRestore();
            });

            it("renders map correctly", async () => {
                const component = getComponent();

                await waitFor(() => expect(component.container.querySelector(".mx_Marker")).toBeInTheDocument());

                expect(component.asFragment()).toMatchSnapshot();
                // map was centered
                expect(mockMapInstance.setCenter).toHaveBeenCalledWith({
                    lat: 51.5076,
                    lon: -0.1276,
                });
            });

            it("opens map dialog on click", async () => {
                const modalSpy = vi
                    .spyOn(Modal, "createDialog")
                    .mockReturnValue({ finished: new Promise(() => {}), close: vi.fn() });
                const component = getComponent();

                await waitFor(() => expect(component.container.querySelector(".mx_Map")).toBeInTheDocument());

                await fireEvent.click(component.container.querySelector(".mx_Map")!);

                expect(modalSpy).toHaveBeenCalled();
            });

            it("renders marker correctly for a self share", async () => {
                const selfShareEvent = makeLocationEvent("geo:51.5076,-0.1276", LocationAssetType.Self);
                const member = new RoomMember(roomId, userId);
                // @ts-ignore cheat assignment to property
                selfShareEvent.sender = member;
                const component = getComponent({ mxEvent: selfShareEvent });

                await waitFor(() => expect(component.container.querySelector(".mx_Marker")).toBeInTheDocument());

                // render self locations with user avatars
                expect(component.asFragment()).toMatchSnapshot();
            });
        });
    });
});
