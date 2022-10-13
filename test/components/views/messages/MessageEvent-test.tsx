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
import { mocked } from "jest-mock";
import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { Features } from "../../../../src/settings/Settings";
import SettingsStore, { CallbackFn } from "../../../../src/settings/SettingsStore";
import { VoiceBroadcastInfoEventType, VoiceBroadcastInfoState } from "../../../../src/voice-broadcast";
import { mkEvent, mkRoom, stubClient } from "../../../test-utils";
import MessageEvent from "../../../../src/components/views/messages/MessageEvent";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";

jest.mock("../../../../src/components/views/messages/UnknownBody", () => ({
    __esModule: true,
    default: () => (<div data-testid="unknown-body" />),
}));

jest.mock("../../../../src/voice-broadcast/components/VoiceBroadcastBody", () => ({
    VoiceBroadcastBody: () => (<div data-testid="voice-broadcast-body" />),
}));

describe("MessageEvent", () => {
    let room: Room;
    let client: MatrixClient;
    let event: MatrixEvent;

    const renderMessageEvent = (): RenderResult => {
        return render(<MessageEvent
            mxEvent={event}
            onHeightChanged={jest.fn()}
            permalinkCreator={new RoomPermalinkCreator(room)}
        />);
    };

    beforeEach(() => {
        client = stubClient();
        room = mkRoom(client, "!room:example.com");
        jest.spyOn(SettingsStore, "getValue");
        jest.spyOn(SettingsStore, "watchSetting");
        jest.spyOn(SettingsStore, "unwatchSetting").mockImplementation(jest.fn());
    });

    describe("when a voice broadcast start event occurs", () => {
        const voiceBroadcastSettingWatcherRef = "vb ref";
        let onVoiceBroadcastSettingChanged: CallbackFn;

        beforeEach(() => {
            event = mkEvent({
                event: true,
                type: VoiceBroadcastInfoEventType,
                user: client.getUserId(),
                room: room.roomId,
                content: {
                    state: VoiceBroadcastInfoState.Started,
                },
            });

            mocked(SettingsStore.watchSetting).mockImplementation(
                (settingName: string, roomId: string | null, callbackFn: CallbackFn) => {
                    if (settingName === Features.VoiceBroadcast) {
                        onVoiceBroadcastSettingChanged = callbackFn;
                        return voiceBroadcastSettingWatcherRef;
                    }
                },
            );
        });

        describe("and the voice broadcast feature is enabled", () => {
            let result: RenderResult;

            beforeEach(() => {
                mocked(SettingsStore.getValue).mockImplementation((settingName: string) => {
                    return settingName === Features.VoiceBroadcast;
                });
                result = renderMessageEvent();
            });

            it("should render a VoiceBroadcast component", () => {
                result.getByTestId("voice-broadcast-body");
            });

            describe("and switching the voice broadcast feature off", () => {
                beforeEach(() => {
                    onVoiceBroadcastSettingChanged(Features.VoiceBroadcast, null, null, null, false);
                });

                it("should render an UnknownBody component", () => {
                    const result = renderMessageEvent();
                    result.getByTestId("unknown-body");
                });
            });

            describe("and unmounted", () => {
                beforeEach(() => {
                    result.unmount();
                });

                it("should unregister the settings watcher", () => {
                    expect(SettingsStore.unwatchSetting).toHaveBeenCalled();
                });
            });
        });

        describe("and the voice broadcast feature is disabled", () => {
            beforeEach(() => {
                mocked(SettingsStore.getValue).mockImplementation((settingName: string) => {
                    return false;
                });
            });

            it("should render an UnknownBody component", () => {
                const result = renderMessageEvent();
                result.getByTestId("unknown-body");
            });
        });
    });
});
