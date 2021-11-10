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

import { UnstableValue } from "matrix-js-sdk/src/NamespacedValue";
import { IContent } from "matrix-js-sdk/src/models/event";

export const POLL_START_EVENT_TYPE = new UnstableValue("m.poll.start", "org.matrix.msc3381.poll.start");
export const POLL_KIND_DISCLOSED = new UnstableValue("m.poll.disclosed", "org.matrix.msc3381.poll.disclosed");
export const POLL_KIND_UNDISCLOSED = new UnstableValue("m.poll.undisclosed", "org.matrix.msc3381.poll.undisclosed");

// TODO: [TravisR] Use extensible events library when ready
const TEXT_NODE_TYPE = "org.matrix.msc1767.text";

export interface IPollAnswer extends IContent {
    id: string;
    [TEXT_NODE_TYPE]: string;
}

export interface IPollContent extends IContent {
    [POLL_START_EVENT_TYPE.name]: {
        kind: string; // disclosed or undisclosed (untypeable for now)
        question: {
            [TEXT_NODE_TYPE]: string;
        };
        answers: IPollAnswer[];
    };
    [TEXT_NODE_TYPE]: string;
}

export function makePollContent(question: string, answers: string[], kind: string): IPollContent {
    question = question.trim();
    answers = answers.map(a => a.trim()).filter(a => !!a);
    return {
        [TEXT_NODE_TYPE]: `${question}\n${answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}`,
        [POLL_START_EVENT_TYPE.name]: {
            kind: kind,
            question: {
                [TEXT_NODE_TYPE]: question,
            },
            answers: answers.map((a, i) => ({ id: `${i}-${a}`, [TEXT_NODE_TYPE]: a })),
        },
    };
}
