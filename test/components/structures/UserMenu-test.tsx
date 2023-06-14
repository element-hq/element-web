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
import { act, render, RenderResult } from "@testing-library/react";
import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";

import UnwrappedUserMenu from "../../../src/components/structures/UserMenu";
import { stubClient, wrapInSdkContext } from "../../test-utils";
import {
    VoiceBroadcastInfoState,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingsStore,
} from "../../../src/voice-broadcast";
import { mkVoiceBroadcastInfoStateEvent } from "../../voice-broadcast/utils/test-utils";
import { TestSdkContext } from "../../TestSdkContext";

describe("<UserMenu>", () => {
    let client: MatrixClient;
    let renderResult: RenderResult;
    let sdkContext: TestSdkContext;
    let voiceBroadcastInfoEvent: MatrixEvent;
    let voiceBroadcastRecording: VoiceBroadcastRecording;
    let voiceBroadcastRecordingsStore: VoiceBroadcastRecordingsStore;

    beforeAll(() => {
        client = stubClient();
        voiceBroadcastInfoEvent = mkVoiceBroadcastInfoStateEvent(
            "!room:example.com",
            VoiceBroadcastInfoState.Started,
            client.getUserId() || "",
            client.getDeviceId() || "",
        );
    });

    beforeEach(() => {
        sdkContext = new TestSdkContext();
        voiceBroadcastRecordingsStore = new VoiceBroadcastRecordingsStore();
        sdkContext._VoiceBroadcastRecordingsStore = voiceBroadcastRecordingsStore;

        voiceBroadcastRecording = new VoiceBroadcastRecording(voiceBroadcastInfoEvent, client);
    });

    describe("when rendered", () => {
        beforeEach(() => {
            const UserMenu = wrapInSdkContext(UnwrappedUserMenu, sdkContext);
            renderResult = render(<UserMenu isPanelCollapsed={true} />);
        });

        it("should render as expected", () => {
            expect(renderResult.container).toMatchSnapshot();
        });

        describe("and a live voice broadcast starts", () => {
            beforeEach(() => {
                act(() => {
                    voiceBroadcastRecordingsStore.setCurrent(voiceBroadcastRecording);
                });
            });

            it("should render the live voice broadcast avatar addon", () => {
                expect(renderResult.queryByTestId("user-menu-live-vb")).toBeInTheDocument();
            });

            describe("and the broadcast ends", () => {
                beforeEach(() => {
                    act(() => {
                        voiceBroadcastRecordingsStore.clearCurrent();
                    });
                });

                it("should not render the live voice broadcast avatar addon", () => {
                    expect(renderResult.queryByTestId("user-menu-live-vb")).not.toBeInTheDocument();
                });
            });
        });
    });
});
