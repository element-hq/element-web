/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { getUserOnboardingCounters } from "../../../../src/components/views/user-onboarding/UserOnboardingList";

const tasks = [
    {
        id: "1",
        title: "Lorem ipsum",
        description: "Lorem ipsum dolor amet.",
        completed: true,
    },
    {
        id: "2",
        title: "Lorem ipsum",
        description: "Lorem ipsum dolor amet.",
        completed: false,
    },
];

describe("getUserOnboardingCounters()", () => {
    it.each([
        {
            tasks: [],
            expectation: {
                completed: 0,
                waiting: 0,
                total: 0,
            },
        },
        {
            tasks: tasks,
            expectation: {
                completed: 1,
                waiting: 1,
                total: 2,
            },
        },
    ])("should calculate counters correctly", ({ tasks, expectation }) => {
        const result = getUserOnboardingCounters(tasks);
        expect(result).toStrictEqual(expectation);
    });
});
