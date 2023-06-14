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
import { mocked } from "jest-mock";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { RelationType } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { M_ASSET, LocationAssetType } from "matrix-js-sdk/src/@types/location";
import { act, fireEvent, render, RenderResult } from "@testing-library/react";
import * as maplibregl from "maplibre-gl";

import LocationShareMenu from "../../../../src/components/views/location/LocationShareMenu";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { ChevronFace } from "../../../../src/components/structures/ContextMenu";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { LocationShareType } from "../../../../src/components/views/location/shareLocation";
import {
    flushPromisesWithFakeTimers,
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
    setupAsyncStoreWithClient,
} from "../../../test-utils";
import Modal from "../../../../src/Modal";
import { DEFAULT_DURATION_MS } from "../../../../src/components/views/location/LiveDurationDropdown";
import { OwnBeaconStore } from "../../../../src/stores/OwnBeaconStore";
import { SettingLevel } from "../../../../src/settings/SettingLevel";
import QuestionDialog from "../../../../src/components/views/dialogs/QuestionDialog";

jest.useFakeTimers();

jest.mock("../../../../src/utils/location/findMapStyleUrl", () => ({
    findMapStyleUrl: jest.fn().mockReturnValue("test"),
}));

jest.mock("../../../../src/settings/SettingsStore", () => ({
    getValue: jest.fn(),
    setValue: jest.fn(),
    monitorSetting: jest.fn(),
    watchSetting: jest.fn(),
    unwatchSetting: jest.fn(),
}));

jest.mock("../../../../src/stores/OwnProfileStore", () => ({
    OwnProfileStore: {
        instance: {
            displayName: "Ernie",
            getHttpAvatarUrl: jest.fn().mockReturnValue("image.com/img"),
        },
    },
}));

jest.mock("../../../../src/Modal", () => ({
    createDialog: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    ModalManagerEvent: { Opened: "opened" },
}));

// Fake random strings to give a predictable snapshot for IDs
jest.mock("matrix-js-sdk/src/randomstring", () => ({
    randomString: () => "abdefghi",
}));

describe("<LocationShareMenu />", () => {
    const userId = "@ernie:server.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getClientWellKnown: jest.fn().mockResolvedValue({
            map_style_url: "maps.com",
        }),
        sendMessage: jest.fn(),
        unstable_createLiveBeacon: jest.fn().mockResolvedValue({ event_id: "1" }),
        unstable_setLiveBeacon: jest.fn().mockResolvedValue({ event_id: "1" }),
        getVisibleRooms: jest.fn().mockReturnValue([]),
    });

    const defaultProps = {
        menuPosition: {
            top: 1,
            left: 1,
            chevronFace: ChevronFace.Bottom,
        },
        onFinished: jest.fn(),
        openMenu: jest.fn(),
        roomId: "!room:server.org",
        sender: new RoomMember("!room:server.org", userId),
    };

    const mockGeolocate = new maplibregl.GeolocateControl({});
    jest.spyOn(mockGeolocate, "on");
    const mapOptions = { container: {} as unknown as HTMLElement, style: "" };
    const mockMap = new maplibregl.Map(mapOptions);
    jest.spyOn(mockMap, "on");

    const position = {
        coords: {
            latitude: -36.24484561954707,
            longitude: 175.46884959563613,
            accuracy: 10,
        },
        timestamp: 1646305006802,
        type: "geolocate",
    };

    const makeOwnBeaconStore = async () => {
        const store = OwnBeaconStore.instance;

        await setupAsyncStoreWithClient(store, mockClient);
        return store;
    };

    const getComponent = (props = {}): RenderResult =>
        render(<LocationShareMenu {...defaultProps} {...props} />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={mockClient}>{children}</MatrixClientContext.Provider>
            ),
        });

    beforeEach(async () => {
        jest.spyOn(logger, "error").mockRestore();
        mocked(SettingsStore).getValue.mockReturnValue(false);
        mockClient.sendMessage.mockClear();
        mockClient.unstable_createLiveBeacon.mockClear().mockResolvedValue({ event_id: "1" });
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient as unknown as MatrixClient);
        mocked(Modal).createDialog.mockClear();

        jest.clearAllMocks();

        await makeOwnBeaconStore();
    });

    const getBackButton = (getByLabelText: RenderResult["getByLabelText"]) => getByLabelText("Back");

    const getCancelButton = (getByLabelText: RenderResult["getByLabelText"]) => getByLabelText("Close");

    const setLocationGeolocate = () => {
        // get the callback LocationShareMenu registered for geolocate
        expect(mocked(mockGeolocate.on)).toHaveBeenCalledWith("geolocate", expect.any(Function));
        const [, onGeolocateCallback] = mocked(mockGeolocate.on).mock.calls.find(([event]) => event === "geolocate")!;

        // set the location
        onGeolocateCallback(position);
    };

    const setLocationClick = () => {
        // get the callback LocationShareMenu registered for geolocate
        expect(mocked(mockMap.on)).toHaveBeenCalledWith("click", expect.any(Function));
        const [, onMapClickCallback] = mocked(mockMap.on).mock.calls.find(([event]) => event === "click")!;

        const event = {
            lngLat: { lng: position.coords.longitude, lat: position.coords.latitude },
        } as unknown as maplibregl.MapMouseEvent;
        // set the location
        onMapClickCallback(event);
    };

    const shareTypeLabels: Record<LocationShareType, string> = {
        [LocationShareType.Own]: "My current location",
        [LocationShareType.Live]: "My live location",
        [LocationShareType.Pin]: "Drop a Pin",
    };
    const setShareType = (getByText: RenderResult["getByText"], shareType: LocationShareType) => {
        fireEvent.click(getByText(shareTypeLabels[shareType]));
    };

    describe("when only Own share type is enabled", () => {
        beforeEach(() => enableSettings([]));

        it("renders own and live location options", () => {
            const { getByText } = getComponent();
            expect(getByText(shareTypeLabels[LocationShareType.Own])).toBeInTheDocument();
            expect(getByText(shareTypeLabels[LocationShareType.Live])).toBeInTheDocument();
        });

        it("renders back button from location picker screen", () => {
            const { getByText, getByLabelText } = getComponent();
            setShareType(getByText, LocationShareType.Own);

            expect(getBackButton(getByLabelText)).toBeInTheDocument();
        });

        it("clicking cancel button from location picker closes dialog", () => {
            const onFinished = jest.fn();
            const { getByLabelText } = getComponent({ onFinished });

            fireEvent.click(getCancelButton(getByLabelText));

            expect(onFinished).toHaveBeenCalled();
        });

        it("creates static own location share event on submission", () => {
            const onFinished = jest.fn();
            const { getByText } = getComponent({ onFinished });

            setShareType(getByText, LocationShareType.Own);

            setLocationGeolocate();

            fireEvent.click(getByText("Share location"));

            expect(onFinished).toHaveBeenCalled();
            const [messageRoomId, relation, messageBody] = mockClient.sendMessage.mock.calls[0];
            expect(messageRoomId).toEqual(defaultProps.roomId);
            expect(relation).toEqual(null);
            expect(messageBody).toEqual(
                expect.objectContaining({
                    [M_ASSET.name]: {
                        type: LocationAssetType.Self,
                    },
                }),
            );
        });
    });

    describe("with pin drop share type enabled", () => {
        it("renders share type switch with own and pin drop options", () => {
            const { getByText } = getComponent();
            expect(document.querySelector(".mx_LocationPicker")).not.toBeInTheDocument();

            expect(getByText(shareTypeLabels[LocationShareType.Own])).toBeInTheDocument();
            expect(getByText(shareTypeLabels[LocationShareType.Pin])).toBeInTheDocument();
        });

        it("does not render back button on share type screen", () => {
            const { queryByLabelText } = getComponent();
            expect(queryByLabelText("Back")).not.toBeInTheDocument();
        });

        it("clicking cancel button from share type screen closes dialog", () => {
            const onFinished = jest.fn();
            const { getByLabelText } = getComponent({ onFinished });

            fireEvent.click(getCancelButton(getByLabelText));

            expect(onFinished).toHaveBeenCalled();
        });

        it("selecting own location share type advances to location picker", () => {
            const { getByText } = getComponent();

            setShareType(getByText, LocationShareType.Own);

            expect(document.querySelector(".mx_LocationPicker")).toBeInTheDocument();
        });

        it("clicking back button from location picker screen goes back to share screen", () => {
            const onFinished = jest.fn();
            const { getByText, getByLabelText } = getComponent({ onFinished });

            // advance to location picker
            setShareType(getByText, LocationShareType.Own);

            expect(document.querySelector(".mx_LocationPicker")).toBeInTheDocument();

            fireEvent.click(getBackButton(getByLabelText));

            // back to share type
            expect(getByText("What location type do you want to share?")).toBeInTheDocument();
        });

        it("creates pin drop location share event on submission", () => {
            const onFinished = jest.fn();
            const { getByText } = getComponent({ onFinished });

            // advance to location picker
            setShareType(getByText, LocationShareType.Pin);

            setLocationClick();

            fireEvent.click(getByText("Share location"));

            expect(onFinished).toHaveBeenCalled();
            const [messageRoomId, relation, messageBody] = mockClient.sendMessage.mock.calls[0];
            expect(messageRoomId).toEqual(defaultProps.roomId);
            expect(relation).toEqual(null);
            expect(messageBody).toEqual(
                expect.objectContaining({
                    [M_ASSET.name]: {
                        type: LocationAssetType.Pin,
                    },
                }),
            );
        });
    });

    describe("with live location disabled", () => {
        beforeEach(() => enableSettings([]));

        it("goes to labs flag screen after live options is clicked", () => {
            const onFinished = jest.fn();
            const { getByText, getByTestId } = getComponent({ onFinished });

            setShareType(getByText, LocationShareType.Live);

            expect(getByTestId("location-picker-enable-live-share")).toMatchSnapshot();
        });

        it("disables OK button when labs flag is not enabled", () => {
            const { getByText } = getComponent();

            setShareType(getByText, LocationShareType.Live);

            expect(getByText("OK").hasAttribute("disabled")).toBeTruthy();
        });

        it("enables OK button when labs flag is toggled to enabled", () => {
            const { getByText, getByLabelText } = getComponent();

            setShareType(getByText, LocationShareType.Live);

            fireEvent.click(getByLabelText("Enable live location sharing"));

            expect(getByText("OK").hasAttribute("disabled")).toBeFalsy();
        });

        it("enables live share setting on ok button submit", () => {
            const { getByText, getByLabelText } = getComponent();

            setShareType(getByText, LocationShareType.Live);

            fireEvent.click(getByLabelText("Enable live location sharing"));

            fireEvent.click(getByText("OK"));

            expect(SettingsStore.setValue).toHaveBeenCalledWith(
                "feature_location_share_live",
                null,
                SettingLevel.DEVICE,
                true,
            );
        });

        it("navigates to location picker when live share is enabled in settings store", () => {
            // @ts-ignore
            mocked(SettingsStore.watchSetting).mockImplementation((featureName, roomId, callback) => {
                callback(featureName, roomId, SettingLevel.DEVICE, "", "");
                window.setTimeout(() => {
                    callback(featureName, roomId, SettingLevel.DEVICE, "", "");
                }, 1000);
            });
            mocked(SettingsStore.getValue).mockReturnValue(false);
            const { getByText, getByLabelText } = getComponent();

            setShareType(getByText, LocationShareType.Live);

            // we're on enable live share screen
            expect(getByLabelText("Enable live location sharing")).toBeInTheDocument();

            act(() => {
                mocked(SettingsStore.getValue).mockReturnValue(true);
                // advance so watchSetting will update the value
                jest.runAllTimers();
            });

            // advanced to location picker
            expect(document.querySelector(".mx_LocationPicker")).toBeInTheDocument();
        });
    });

    describe("Live location share", () => {
        beforeEach(() => enableSettings(["feature_location_share_live"]));

        it("does not display live location share option when composer has a relation", () => {
            const relation = {
                rel_type: RelationType.Thread,
                event_id: "12345",
            };
            const { queryByText } = getComponent({ relation });

            expect(queryByText(shareTypeLabels[LocationShareType.Live])).not.toBeInTheDocument();
        });

        it("creates beacon info event on submission", async () => {
            const onFinished = jest.fn();
            const { getByText } = getComponent({ onFinished });

            // advance to location picker
            setShareType(getByText, LocationShareType.Live);
            setLocationGeolocate();

            fireEvent.click(getByText("Share location"));

            // flush stopping existing beacons promises
            await flushPromisesWithFakeTimers();

            expect(onFinished).toHaveBeenCalled();
            const [eventRoomId, eventContent] = mockClient.unstable_createLiveBeacon.mock.calls[0];
            expect(eventRoomId).toEqual(defaultProps.roomId);
            expect(eventContent).toEqual(
                expect.objectContaining({
                    // default timeout
                    timeout: DEFAULT_DURATION_MS,
                    description: `Ernie's live location`,
                    live: true,
                    [M_ASSET.name]: {
                        type: LocationAssetType.Self,
                    },
                }),
            );
        });

        it("opens error dialog when beacon creation fails", async () => {
            // stub logger to keep console clean from expected error
            const logSpy = jest.spyOn(logger, "error").mockReturnValue(undefined);
            const error = new Error("oh no");
            mockClient.unstable_createLiveBeacon.mockRejectedValue(error);
            const { getByText } = getComponent();

            // advance to location picker
            setShareType(getByText, LocationShareType.Live);
            setLocationGeolocate();

            fireEvent.click(getByText("Share location"));

            await flushPromisesWithFakeTimers();
            await flushPromisesWithFakeTimers();
            await flushPromisesWithFakeTimers();

            expect(logSpy).toHaveBeenCalledWith("We couldn't start sharing your live location", error);
            expect(mocked(Modal).createDialog).toHaveBeenCalledWith(
                QuestionDialog,
                expect.objectContaining({
                    button: "Try again",
                    description: "Element could not send your location. Please try again later.",
                    title: `We couldn't send your location`,
                    cancelButton: "Cancel",
                }),
            );
        });

        it("opens error dialog when beacon creation fails with permission error", async () => {
            // stub logger to keep console clean from expected error
            const logSpy = jest.spyOn(logger, "error").mockReturnValue(undefined);
            const error = { errcode: "M_FORBIDDEN" } as unknown as Error;
            mockClient.unstable_createLiveBeacon.mockRejectedValue(error);
            const { getByText } = getComponent();

            // advance to location picker
            setShareType(getByText, LocationShareType.Live);
            setLocationGeolocate();

            fireEvent.click(getByText("Share location"));

            await flushPromisesWithFakeTimers();
            await flushPromisesWithFakeTimers();
            await flushPromisesWithFakeTimers();

            expect(logSpy).toHaveBeenCalledWith("Insufficient permissions to start sharing your live location", error);
            expect(mocked(Modal).createDialog).toHaveBeenCalledWith(
                QuestionDialog,
                expect.objectContaining({
                    button: "OK",
                    description: "You need to have the right permissions in order to share locations in this room.",
                    title: `You don't have permission to share locations`,
                    hasCancelButton: false,
                }),
            );
        });
    });
});

function enableSettings(settings: string[]) {
    mocked(SettingsStore).getValue.mockReturnValue(false);
    mocked(SettingsStore).getValue.mockImplementation((settingName: string): any => settings.includes(settingName));
}
