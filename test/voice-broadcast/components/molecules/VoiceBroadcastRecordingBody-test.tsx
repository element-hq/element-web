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
import { mocked } from "jest-mock";

import { VoiceBroadcastRecordingBody } from "../../../../src/voice-broadcast";
import MemberAvatar from "../../../../src/components/views/avatars/MemberAvatar";

jest.mock("../../../../src/components/views/avatars/MemberAvatar", () => jest.fn());

describe("VoiceBroadcastRecordingBody", () => {
    const title = "Test Title";
    const userId = "@user:example.com";
    const roomMember = new RoomMember("!room:example.com", userId);
    let onClick: MouseEventHandler<HTMLDivElement>;

    beforeEach(() => {
        onClick = jest.fn();
        // @ts-ignore
        mocked(MemberAvatar).mockReturnValue(<div data-testid="member-avatar" />);
    });

    describe("when rendered", () => {
        let renderResult: RenderResult;

        beforeEach(() => {
            renderResult = render(
                <VoiceBroadcastRecordingBody
                    onClick={onClick}
                    title={title}
                    userId={userId}
                    live={true}
                    member={roomMember}
                />,
            );
        });

        it("should render the expected HTML", () => {
            expect(renderResult.container).toMatchSnapshot();
        });

        it("should pass the props to MemberAvatar", () => {
            expect(mocked(MemberAvatar)).toHaveBeenCalledWith(
                {
                    member: roomMember,
                    fallbackUserId: userId,
                },
                {},
            );
        });

        describe("and clicked", () => {
            beforeEach(async () => {
                await userEvent.click(renderResult.getByText(title));
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
                    title={title}
                    userId={userId}
                    live={false}
                    member={roomMember}
                />,
            );
        });

        it("should not render the live badge", () => {
            expect(renderResult.queryByText("Live")).toBeFalsy();
        });
    });
});
