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

import { render } from "@testing-library/react";
import { MatrixClient, PendingEventOrdering } from "matrix-js-sdk/src/client";
import { Feature, ServerSupport } from "matrix-js-sdk/src/feature";
import { NotificationCountType, Room } from "matrix-js-sdk/src/models/room";
import React from "react";

import RoomHeaderButtons from "../../../../src/components/views/right_panel/RoomHeaderButtons";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { stubClient } from "../../../test-utils";

describe("RoomHeaderButtons-test.tsx", function() {
    const ROOM_ID = "!roomId:example.org";
    let room: Room;
    let client: MatrixClient;

    beforeEach(() => {
        jest.clearAllMocks();

        stubClient();
        client = MatrixClientPeg.get();
        room = new Room(ROOM_ID, client, client.getUserId() ?? "", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        jest.spyOn(SettingsStore, "getValue").mockImplementation((name: string) => {
            if (name === "feature_thread") return true;
        });
    });

    function getComponent(room?: Room) {
        return render(<RoomHeaderButtons
            room={room}
            excludedRightPanelPhaseButtons={[]}
        />);
    }

    function getThreadButton(container) {
        return container.querySelector(".mx_RightPanel_threadsButton");
    }

    function isIndicatorOfType(container, type: "red" | "gray") {
        return container.querySelector(".mx_RightPanel_threadsButton .mx_Indicator")
            .className
            .includes(type);
    }

    it("shows the thread button", () => {
        const { container } = getComponent(room);
        expect(getThreadButton(container)).not.toBeNull();
    });

    it("hides the thread button", () => {
        jest.spyOn(SettingsStore, "getValue").mockReset().mockReturnValue(false);
        const { container } = getComponent(room);
        expect(getThreadButton(container)).toBeNull();
    });

    it("room wide notification does not change the thread button", () => {
        room.setUnreadNotificationCount(NotificationCountType.Highlight, 1);
        room.setUnreadNotificationCount(NotificationCountType.Total, 1);

        const { container } = getComponent(room);

        expect(container.querySelector(".mx_RightPanel_threadsButton .mx_Indicator")).toBeNull();
    });

    it("room wide notification does not change the thread button", () => {
        const { container } = getComponent(room);

        room.setThreadUnreadNotificationCount("$123", NotificationCountType.Total, 1);
        expect(isIndicatorOfType(container, "gray")).toBe(true);

        room.setThreadUnreadNotificationCount("$123", NotificationCountType.Highlight, 1);
        expect(isIndicatorOfType(container, "red")).toBe(true);

        room.setThreadUnreadNotificationCount("$123", NotificationCountType.Total, 0);
        room.setThreadUnreadNotificationCount("$123", NotificationCountType.Highlight, 0);

        expect(container.querySelector(".mx_RightPanel_threadsButton .mx_Indicator")).toBeNull();
    });

    it("does not explode without a room", () => {
        client.canSupport.set(Feature.ThreadUnreadNotifications, ServerSupport.Unsupported);
        expect(() => getComponent()).not.toThrow();
    });
});
