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
import { IPollAnswer } from "matrix-js-sdk/src/@types/polls";

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
    answers?: IPollAnswer[],
): MatrixEvent {
    if (!answers) {
        answers = [
            { "id": "socks", "org.matrix.msc1767.text": "Socks" },
            { "id": "shoes", "org.matrix.msc1767.text": "Shoes" },
        ];
    }

    return new MatrixEvent(
        {
            "event_id": "$mypoll",
            "room_id": "#myroom:example.com",
            "sender": sender,
            "content": {
                "org.matrix.msc3381.poll.start": {
                    "question": {
                        "org.matrix.msc1767.text": question,
                    },
                    "kind": "org.matrix.msc3381.poll.disclosed",
                    "answers": answers,
                },
                "org.matrix.msc1767.text": `${question}: answers`,
            },
        },
    );
}

