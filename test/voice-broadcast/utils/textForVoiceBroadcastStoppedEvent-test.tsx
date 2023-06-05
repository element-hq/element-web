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
import { render, RenderResult, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";
import { MatrixClient, RelationType } from "matrix-js-sdk/src/matrix";

import { textForVoiceBroadcastStoppedEvent, VoiceBroadcastInfoState } from "../../../src/voice-broadcast";
import { stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";
import dis from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";

jest.mock("../../../src/dispatcher/dispatcher");

describe("textForVoiceBroadcastStoppedEvent", () => {
    const otherUserId = "@other:example.com";
    const roomId = "!room:example.com";
    let client: MatrixClient;

    const renderText = (senderId: string, startEventId?: string) => {
        const event = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Stopped,
            senderId,
            client.deviceId!,
        );

        if (startEventId) {
            event.getContent()["m.relates_to"] = {
                rel_type: RelationType.Reference,
                event_id: startEventId,
            };
        }

        return render(<div>{textForVoiceBroadcastStoppedEvent(event, client)()}</div>);
    };

    beforeEach(() => {
        client = stubClient();
    });

    it("should render own broadcast as expected", () => {
        expect(renderText(client.getUserId()!).container).toMatchSnapshot();
    });

    it("should render other users broadcast as expected", () => {
        expect(renderText(otherUserId).container).toMatchSnapshot();
    });

    it("should render without login as expected", () => {
        mocked(client.getUserId).mockReturnValue(null);
        expect(renderText(otherUserId).container).toMatchSnapshot();
    });

    describe("when rendering an event with relation to the start event", () => {
        let result: RenderResult;

        beforeEach(() => {
            result = renderText(client.getUserId()!, "$start-id");
        });

        it("should render events with relation to the start event", () => {
            expect(result.container).toMatchSnapshot();
        });

        describe("and clicking the link", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByRole("button"));
            });

            it("should dispatch an action to highlight the event", () => {
                expect(dis.dispatch).toHaveBeenCalledWith({
                    action: Action.ViewRoom,
                    event_id: "$start-id",
                    highlighted: true,
                    room_id: roomId,
                    metricsTrigger: undefined, // room doesn't change
                });
            });
        });
    });
});
