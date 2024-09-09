/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, RenderResult } from "@testing-library/react";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import SettingsStore from "../../../../src/settings/SettingsStore";
import { VoiceBroadcastInfoEventType, VoiceBroadcastInfoState } from "../../../../src/voice-broadcast";
import { mkEvent, mkRoom, stubClient } from "../../../test-utils";
import MessageEvent from "../../../../src/components/views/messages/MessageEvent";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";

jest.mock("../../../../src/components/views/messages/UnknownBody", () => ({
    __esModule: true,
    default: () => <div data-testid="unknown-body" />,
}));

jest.mock("../../../../src/voice-broadcast/components/VoiceBroadcastBody", () => ({
    VoiceBroadcastBody: () => <div data-testid="voice-broadcast-body" />,
}));

describe("MessageEvent", () => {
    let room: Room;
    let client: MatrixClient;
    let event: MatrixEvent;

    const renderMessageEvent = (): RenderResult => {
        return render(
            <MessageEvent
                mxEvent={event}
                onHeightChanged={jest.fn()}
                permalinkCreator={new RoomPermalinkCreator(room)}
            />,
        );
    };

    beforeEach(() => {
        client = stubClient();
        room = mkRoom(client, "!room:example.com");
        jest.spyOn(SettingsStore, "getValue");
        jest.spyOn(SettingsStore, "watchSetting");
        jest.spyOn(SettingsStore, "unwatchSetting").mockImplementation(jest.fn());
    });

    describe("when a voice broadcast start event occurs", () => {
        let result: RenderResult;

        beforeEach(() => {
            event = mkEvent({
                event: true,
                type: VoiceBroadcastInfoEventType,
                user: client.getUserId()!,
                room: room.roomId,
                content: {
                    state: VoiceBroadcastInfoState.Started,
                },
            });
            result = renderMessageEvent();
        });

        it("should render a VoiceBroadcast component", () => {
            result.getByTestId("voice-broadcast-body");
        });
    });
});
