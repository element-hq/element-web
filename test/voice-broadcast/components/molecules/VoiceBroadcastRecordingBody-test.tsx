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

import React, { MouseEventHandler } from "react";
import { render, RenderResult } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoomMember } from "matrix-js-sdk/src/matrix";

import { VoiceBroadcastHeader, VoiceBroadcastRecordingBody } from "../../../../src/voice-broadcast";

jest.mock("../../../../src/voice-broadcast/components/atoms/VoiceBroadcastHeader", () => ({
    VoiceBroadcastHeader: ({ live, sender, roomName }: React.ComponentProps<typeof VoiceBroadcastHeader>) => {
        return <div data-testid="voice-broadcast-header">
            live: { live },
            sender: { sender.userId },
            room name: { roomName }
        </div>;
    },
}));

describe("VoiceBroadcastRecordingBody", () => {
    const testRoomName = "test room name";
    const userId = "@user:example.com";
    const roomMember = new RoomMember("!room:example.com", userId);
    let onClick: MouseEventHandler<HTMLDivElement>;

    beforeEach(() => {
        onClick = jest.fn();
    });

    describe("when rendered", () => {
        let renderResult: RenderResult;

        beforeEach(() => {
            renderResult = render(
                <VoiceBroadcastRecordingBody
                    onClick={onClick}
                    roomName={testRoomName}
                    live={true}
                    sender={roomMember}
                />,
            );
        });

        it("should render the expected HTML", () => {
            expect(renderResult.container).toMatchSnapshot();
        });

        describe("and clicked", () => {
            beforeEach(async () => {
                await userEvent.click(renderResult.getByTestId("voice-broadcast-header"));
            });

            it("should call the onClick prop", () => {
                expect(onClick).toHaveBeenCalled();
            });
        });
    });

    describe("when non-live rendered", () => {
        let renderResult: RenderResult;

        beforeEach(() => {
            renderResult = render(
                <VoiceBroadcastRecordingBody
                    onClick={onClick}
                    roomName={testRoomName}
                    live={false}
                    sender={roomMember}
                />,
            );
        });

        it("should not render the live badge", () => {
            expect(renderResult.queryByText("Live")).toBeFalsy();
        });
    });
});
