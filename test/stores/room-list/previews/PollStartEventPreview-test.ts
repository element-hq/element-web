/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk";
import { POLL_ANSWER, M_TEXT, M_POLL_KIND_DISCLOSED, M_POLL_START } from "matrix-events-sdk";

import { PollStartEventPreview } from "../../../../src/stores/room-list/previews/PollStartEventPreview";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";

MatrixClientPeg.matrixClient = {
    getUserId: () => "@me:example.com",
};

describe("PollStartEventPreview", () => {
    it("shows the question for a poll I created", async () => {
        const pollStartEvent = newPollStartEvent("My Question", "@me:example.com");
        const preview = new PollStartEventPreview();
        expect(preview.getTextFor(pollStartEvent)).toBe("My Question");
    });

    it("shows the sender and question for a poll created by someone else", async () => {
        const pollStartEvent = newPollStartEvent("Your Question", "@yo:example.com");
        const preview = new PollStartEventPreview();
        expect(preview.getTextFor(pollStartEvent)).toBe("@yo:example.com: Your Question");
    });
});

function newPollStartEvent(
    question: string,
    sender: string,
    answers?: POLL_ANSWER[],
): MatrixEvent {
    if (!answers) {
        answers = [
            { "id": "socks", [M_TEXT.name]: "Socks" },
            { "id": "shoes", [M_TEXT.name]: "Shoes" },
        ];
    }

    return new MatrixEvent(
        {
            "event_id": "$mypoll",
            "room_id": "#myroom:example.com",
            "sender": sender,
            "type": M_POLL_START.name,
            "content": {
                [M_POLL_START.name]: {
                    "question": {
                        [M_TEXT.name]: question,
                    },
                    "kind": M_POLL_KIND_DISCLOSED.name,
                    "answers": answers,
                },
                [M_TEXT.name]: `${question}: answers`,
            },
        },
    );
}

