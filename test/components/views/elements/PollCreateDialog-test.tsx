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

// skinned-sdk should be the first import in most tests
import '../../../skinned-sdk';
import React from "react";
import { mount, ReactWrapper } from "enzyme";
import { Room } from "matrix-js-sdk/src/models/room";

import * as TestUtils from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import _PollCreateDialog from "../../../../src/components/views/elements/PollCreateDialog";
const PollCreateDialog = TestUtils.wrapInMatrixClientContext(_PollCreateDialog);

// Fake date to give a predictable snapshot
const realDateNow = Date.now;
const realDateToISOString = Date.prototype.toISOString;
Date.now = jest.fn(() => 2345678901234);
// eslint-disable-next-line no-extend-native
Date.prototype.toISOString = jest.fn(() => "2021-11-23T14:35:14.240Z");
afterAll(() => {
    Date.now = realDateNow;
    // eslint-disable-next-line no-extend-native
    Date.prototype.toISOString = realDateToISOString;
});

describe("PollCreateDialog", () => {
    it("renders a blank poll", () => {
        const dialog = mount(
            <PollCreateDialog room={createRoom()} onFinished={jest.fn()} />,
        );
        expect(dialog).toMatchSnapshot();
    });

    it("renders a question and some options", () => {
        const dialog = mount(
            <PollCreateDialog room={createRoom()} onFinished={jest.fn()} />,
        );
        expect(submitIsDisabled(dialog)).toBe(true);

        // When I set some values in the boxes
        changeValue(
            dialog,
            "Question or topic",
            "How many turnips is the optimal number?",
        );
        changeValue(dialog, "Option 1", "As many as my neighbour");
        changeValue(dialog, "Option 2", "The question is meaningless");
        dialog.find("div.mx_PollCreateDialog_addOption").simulate("click");
        changeValue(dialog, "Option 3", "Mu");
        expect(dialog).toMatchSnapshot();
    });

    it("doesn't allow submitting until there are options", () => {
        const dialog = mount(
            <PollCreateDialog room={createRoom()} onFinished={jest.fn()} />,
        );
        expect(submitIsDisabled(dialog)).toBe(true);
    });

    it("does allow submitting when there are options and a question", () => {
        // Given a dialog with no info in (which I am unable to submit)
        const dialog = mount(
            <PollCreateDialog room={createRoom()} onFinished={jest.fn()} />,
        );
        expect(submitIsDisabled(dialog)).toBe(true);

        // When I set some values in the boxes
        changeValue(dialog, "Question or topic", "Q");
        changeValue(dialog, "Option 1", "A1");
        changeValue(dialog, "Option 2", "A2");

        // Then I am able to submit
        expect(submitIsDisabled(dialog)).toBe(false);
    });

    it("displays a spinner after submitting", () => {
        TestUtils.stubClient();
        MatrixClientPeg.get().sendEvent = jest.fn(() => Promise.resolve());

        const dialog = mount(
            <PollCreateDialog room={createRoom()} onFinished={jest.fn()} />,
        );
        changeValue(dialog, "Question or topic", "Q");
        changeValue(dialog, "Option 1", "A1");
        changeValue(dialog, "Option 2", "A2");
        expect(dialog.find("Spinner").length).toBe(0);

        dialog.find("button").simulate("click");
        expect(dialog.find("Spinner").length).toBe(1);
    });
});

function createRoom(): Room {
    return new Room(
        "roomid",
        MatrixClientPeg.get(),
        "@name:example.com",
        {},
    );
}

function changeValue(wrapper: ReactWrapper, labelText: string, value: string) {
    wrapper.find(`input[label="${labelText}"]`).simulate(
        "change",
        { target: { value: value } },
    );
}

function submitIsDisabled(wrapper: ReactWrapper) {
    return wrapper.find('button[type="submit"]').prop("aria-disabled") === true;
}

