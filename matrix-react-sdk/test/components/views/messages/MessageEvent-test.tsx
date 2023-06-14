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
