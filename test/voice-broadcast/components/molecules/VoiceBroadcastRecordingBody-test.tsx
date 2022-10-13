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
import userEvent from "@testing-library/user-event";
import { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";

import {
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
    VoiceBroadcastRecording,
    VoiceBroadcastRecordingBody,
} from "../../../../src/voice-broadcast";
import { mkEvent, stubClient } from "../../../test-utils";

describe("VoiceBroadcastRecordingBody", () => {
    const userId = "@user:example.com";
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let infoEvent: MatrixEvent;
    let recording: VoiceBroadcastRecording;

    beforeAll(() => {
        client = stubClient();
        infoEvent = mkEvent({
            event: true,
            type: VoiceBroadcastInfoEventType,
            content: {},
            room: roomId,
            user: userId,
        });
        recording = new VoiceBroadcastRecording(infoEvent, client);
    });

    describe("when rendering a live broadcast", () => {
        let renderResult: RenderResult;

        beforeEach(() => {
            renderResult = render(<VoiceBroadcastRecordingBody recording={recording} />);
        });

        it("should render the expected HTML", () => {
            expect(renderResult.container).toMatchSnapshot();
        });

        describe("and clicked", () => {
            beforeEach(async () => {
                await userEvent.click(renderResult.getByText("My room"));
            });

            it("should stop the recording", () => {
                expect(recording.getState()).toBe(VoiceBroadcastInfoState.Stopped);
            });
        });
    });

    describe("when rendering a non-live broadcast", () => {
        let renderResult: RenderResult;

        beforeEach(() => {
            recording.stop();
            renderResult = render(<VoiceBroadcastRecordingBody recording={recording} />);
        });

        it("should not render the live badge", () => {
            expect(renderResult.queryByText("Live")).toBeFalsy();
        });
    });
});
