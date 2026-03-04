/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { MatrixWidgetType } from "matrix-widget-api";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import {
    WidgetContextMenuViewModel,
    type WidgetContextMenuViewModelProps,
} from "../../../src/viewmodels/right-panel/WidgetContextMenuViewModel";
import { stubClient } from "../../test-utils";
import WidgetUtils from "../../../src/utils/WidgetUtils";
import { type IApp } from "../../../src/utils/WidgetUtils-types";
import { Container, WidgetLayoutStore } from "../../../src/stores/widgets/WidgetLayoutStore";
import * as livestream from "../../../src/Livestream";
import Modal from "../../../src/Modal";
import SettingsStore from "../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import * as widgetStore from "../../../src/stores/WidgetStore";
import { WidgetMessagingStore } from "../../../src/stores/widgets/WidgetMessagingStore";
import { type WidgetMessaging } from "../../../src/stores/widgets/WidgetMessaging";

describe("WidgetContextMenuViewModel", () => {
    const widgetId = "w1";
    const eventId = "e1";
    const roomId = "r1";
    const userId = "@user-id:server";

    const app: IApp = {
        id: widgetId,
        eventId,
        roomId,
        type: MatrixWidgetType.Custom,
        url: "https://example.com",
        name: "Example 1",
        creatorUserId: userId,
        avatar_url: undefined,
    };

    let client: MatrixClient;
    const defaultProps: WidgetContextMenuViewModelProps = {
        menuDisplayed: true,
        room: undefined,
        roomId,
        cli: stubClient(),
        app,
        showUnpin: true,
        userWidget: true,
        trigger: <></>,
        onEditClick: jest.fn(),
        onDeleteClick: jest.fn(),
        onFinished: jest.fn(),
    };

    beforeEach(() => {
        jest.spyOn(WidgetUtils, "canUserModifyWidgets").mockReturnValue(true);
        jest.spyOn(WidgetUtils, "isManagedByManager").mockReturnValue(true);
        jest.spyOn(WidgetUtils, "editWidget").mockReturnValue();
        const mockMessaging = {
            on: () => {},
            off: () => {},
            stop: () => {},
            widgetApi: {
                hasCapability: jest.fn(),
            },
        } as unknown as WidgetMessaging;
        jest.spyOn(WidgetMessagingStore.instance, "getMessagingForUid").mockReturnValue(mockMessaging);
        client = stubClient();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should return the snapshot", () => {
        const vm = new WidgetContextMenuViewModel(defaultProps);
        expect(vm.getSnapshot()).toMatchObject({
            showStreamAudioStreamButton: false, // because widget type is custom and not jitsi
            showEditButton: true, // because default mock return true on canUserModifyWidgets and isManagedByManager
            showRevokeButton: false,
            showDeleteButton: true,
            showSnapshotButton: false, // because no default value for sdkconfig "enableWidgetScreenshots"
            showMoveButtons: [false, false],
            canModify: true,
            isMenuOpened: true,
            trigger: <></>,
        });
    });

    it("should call edit widget no custom edit function passed and room exist", () => {
        const props = {
            ...defaultProps,
            room: new Room(roomId, client, userId),
            onEditClick: undefined,
        };
        const vm = new WidgetContextMenuViewModel(props);
        vm.onEditClick();
        expect(WidgetUtils.editWidget).toHaveBeenCalled();
        expect(props.onFinished).toHaveBeenCalled();
    });

    it("should call custom onEditClick if passed as props and room exist", () => {
        const props = {
            ...defaultProps,
            room: new Room(roomId, client, userId),
        };
        const vm = new WidgetContextMenuViewModel(props);
        vm.onEditClick();

        expect(props.onEditClick).toHaveBeenCalled();
        expect(props.onFinished).toHaveBeenCalled();
    });

    it("should just call finish if no custom onEditClick is passed as props and does not room exist", () => {
        const props = {
            ...defaultProps,
            room: undefined,
            onEditClick: undefined,
        };
        const vm = new WidgetContextMenuViewModel(props);
        vm.onEditClick();

        expect(WidgetUtils.editWidget).not.toHaveBeenCalled();
        expect(props.onFinished).toHaveBeenCalled();
    });

    it("should move widget position when onmovebutton is called", () => {
        jest.spyOn(WidgetLayoutStore.instance, "moveWithinContainer").mockReturnValue();
        const props = {
            ...defaultProps,
            room: new Room(roomId, client, userId),
        };
        const vm = new WidgetContextMenuViewModel(props);
        vm.onMoveButton(1);

        expect(WidgetLayoutStore.instance.moveWithinContainer).toHaveBeenCalledWith(
            props.room,
            Container.Top,
            props.app,
            1,
        );
        expect(props.onFinished).toHaveBeenCalled();
    });

    it("should throw error when onmovebutton is called and no room is given", () => {
        const props = {
            ...defaultProps,
            room: undefined,
        };
        const vm = new WidgetContextMenuViewModel(props);

        expect(() => vm.onMoveButton(1)).toThrow();
    });

    it("should startJitsiAudioLivestream when onStreamAudioClick button is clicked", async () => {
        jest.spyOn(livestream, "startJitsiAudioLivestream").mockImplementation(jest.fn());
        jest.spyOn(livestream, "getConfigLivestreamUrl").mockReturnValue("https://url");
        const props = {
            ...defaultProps,
            room: new Room(roomId, client, userId),
        };
        const vm = new WidgetContextMenuViewModel(props);
        vm.onStreamAudioClick();
        await expect(livestream.startJitsiAudioLivestream).toHaveBeenCalled();
        expect(props.onFinished).toHaveBeenCalled();
    });

    it("should show modal when startJitsiAudioLivestream is on error and onStreamAudioClick button is clicked", async () => {
        jest.spyOn(livestream, "startJitsiAudioLivestream").mockImplementation(() => {
            console.log("failllllled");
            throw new Error("Failed");
        });
        jest.spyOn(livestream, "getConfigLivestreamUrl").mockReturnValue("https://url");
        jest.spyOn(Modal, "createDialog").mockReturnValue({
            finished: Promise.resolve([true, true, false]),
            close: jest.fn(),
        });

        const props = {
            ...defaultProps,
            room: new Room(roomId, client, userId),
        };
        const vm = new WidgetContextMenuViewModel(props);
        await vm.onStreamAudioClick();
        expect(Modal.createDialog).toHaveBeenCalled();
    });

    it("should throw when no room is given and onStreamAudioClick button is clicked", async () => {
        jest.spyOn(livestream, "startJitsiAudioLivestream").mockImplementation(jest.fn());
        jest.spyOn(livestream, "getConfigLivestreamUrl").mockReturnValue("https://url");
        const props = {
            ...defaultProps,
            room: new Room(roomId, client, userId),
        };
        const vm = new WidgetContextMenuViewModel(props);
        await vm.onStreamAudioClick();
        // nothing happened
        expect(props.onFinished).toHaveBeenCalled();
    });

    it("should call custom delete function when it is given in props", () => {
        const props = {
            ...defaultProps,
        };
        const vm = new WidgetContextMenuViewModel(props);
        vm.onDeleteClick();
        expect(props.onDeleteClick).toHaveBeenCalled();
        expect(props.onFinished).toHaveBeenCalled();
    });

    it("should display modal when no custom function is provided and a room is given", () => {
        jest.spyOn(Modal, "createDialog").mockReturnValue({
            finished: Promise.resolve([true, true, false]),
            close: jest.fn(),
        });

        const props = {
            ...defaultProps,
            room: new Room(roomId, client, userId),
            onDeleteClick: undefined,
        };
        const vm = new WidgetContextMenuViewModel(props);

        vm.onDeleteClick();

        expect(Modal.createDialog).toHaveBeenCalled();
        expect(props.onFinished).toHaveBeenCalled();
    });

    it("should do nothing when onDeleteClick and no custom function and no room is provided", () => {
        const props = {
            ...defaultProps,
            room: undefined,
            onDeleteClick: undefined,
        };
        const vm = new WidgetContextMenuViewModel(props);

        vm.onDeleteClick();

        expect(props.onFinished).toHaveBeenCalled();
    });

    it("should set new level for allowedwidget when onrevoke button is clicked", () => {
        const current = { [eventId]: true };
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(current);
        jest.spyOn(SettingsStore, "firstSupportedLevel").mockReturnValue(SettingLevel.DEFAULT);
        jest.spyOn(SettingsStore, "setValue").mockResolvedValue();
        jest.spyOn(widgetStore, "isAppWidget").mockReturnValue(true);
        const props = {
            ...defaultProps,
            room: new Room(roomId, client, userId),
        };
        const vm = new WidgetContextMenuViewModel(props);

        vm.onRevokeClick();

        expect(SettingsStore.setValue).toHaveBeenCalledWith(
            "allowedWidgets",
            props.roomId,
            SettingLevel.DEFAULT,
            current,
        );

        const current2 = { [eventId]: false };
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(current2);
        jest.spyOn(SettingsStore, "firstSupportedLevel").mockReturnValue(SettingLevel.DEFAULT);
        jest.spyOn(SettingsStore, "setValue").mockResolvedValue();
        jest.spyOn(widgetStore, "isAppWidget").mockReturnValue(false);

        vm.onRevokeClick();

        expect(SettingsStore.setValue).toHaveBeenCalledWith(
            "allowedWidgets",
            props.roomId,
            SettingLevel.DEFAULT,
            current2,
        );
    });

    it("should throw an error when first supported level is not set", () => {
        jest.spyOn(SettingsStore, "firstSupportedLevel").mockReturnValue(null);
        const props = {
            ...defaultProps,
            room: undefined,
            onDeleteClick: undefined,
        };
        const vm = new WidgetContextMenuViewModel(props);

        expect(() => vm.onRevokeClick()).toThrow();
    });
});
