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
        client = stubClient();
    });

    it("should return the snapshot", () => {
        const vm = new WidgetContextMenuViewModel(defaultProps);
        expect(vm.getSnapshot()).toMatchObject({
            showStreamAudioStreamButton: true,
            showEditButton: true,
            showRevokeButton: true,
            showDeleteButton: true,
            showSnapshotButton: true,
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
        expect(vm.onFinished).toHaveBeenCalled();
    });

    it("should call custom onEditClick if passed as props and room exist", () => {
        const props = {
            ...defaultProps,
            room: new Room(roomId, client, userId),
            onEditClick: jest.fn(),
        };
        const vm = new WidgetContextMenuViewModel(props);
        vm.onEditClick();

        expect(props.onEditClick).toHaveBeenCalled();
        expect(vm.onFinished).toHaveBeenCalled();
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
        expect(props.onEditClick).not.toHaveBeenCalled();
        expect(vm.onFinished).toHaveBeenCalled();
    });

    it("should move container when onmovebutton is called", () => {});
});
