/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React from "react";
import { act, fireEvent, render, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";
import { RoomMember, EventType } from "matrix-js-sdk/src/matrix";

import { getMockClientWithEventEmitter, makeRoomWithStateEvents, mkEvent } from "../../../../test-utils";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import {
    AddPrivilegedUsers,
    getUserIdsFromCompletions,
    hasLowerOrEqualLevelThanDefaultLevel,
} from "../../../../../src/components/views/settings/AddPrivilegedUsers";
import UserProvider from "../../../../../src/autocomplete/UserProvider";
import { type ICompletion } from "../../../../../src/autocomplete/Autocompleter";

jest.mock("../../../../../src/autocomplete/UserProvider");
jest.mock("../../../../../src/stores/WidgetStore");
jest.mock("../../../../../src/stores/widgets/WidgetLayoutStore");

const completions: ICompletion[] = [
    {
        component: <div />,
        type: "user",
        completion: "user_1",
        completionId: "@user_1:host.local",
        range: { start: 1, end: 1 },
    },
    {
        component: <div />,
        type: "user",
        completion: "user_2",
        completionId: "@user_2:host.local",
        range: { start: 1, end: 1 },
    },
    { component: <div />, type: "user", completion: "user_without_completion_id", range: { start: 1, end: 1 } },
];

describe("<AddPrivilegedUsers />", () => {
    const provider = mocked(UserProvider, { shallow: true });
    provider.prototype.getCompletions.mockResolvedValue(completions);

    const mockClient = getMockClientWithEventEmitter({
        // `makeRoomWithStateEvents` only work's if `getRoom` is present.
        getRoom: jest.fn(),
        setPowerLevel: jest.fn(),
    });

    const room = makeRoomWithStateEvents([], { roomId: "room_id", mockClient: mockClient });
    room.getMember = (userId: string) => {
        const member = new RoomMember("room_id", userId);
        member.powerLevel = 0;

        return member;
    };
    (room.currentState.getStateEvents as unknown) = (_eventType: string, _stateKey: string) => {
        return mkEvent({
            type: EventType.RoomPowerLevels,
            content: {},
            user: "user_id",
        });
    };

    const getComponent = () => (
        <MatrixClientContext.Provider value={mockClient}>
            <AddPrivilegedUsers room={room} defaultUserLevel={0} />
        </MatrixClientContext.Provider>
    );

    it("checks whether form submit works as intended", async () => {
        const { getByTestId, queryAllByTestId } = render(getComponent());

        // Verify that the submit button is disabled initially.
        const submitButton = getByTestId("add-privileged-users-submit-button");
        expect(submitButton).toBeDisabled();

        // Find some suggestions and select them.
        const autocompleteInput = getByTestId("autocomplete-input");

        await act(async () => {
            fireEvent.focus(autocompleteInput);
            fireEvent.change(autocompleteInput, { target: { value: "u" } });
            await waitFor(() => expect(provider.mock.instances[0].getCompletions).toHaveBeenCalledTimes(1));
        });

        const matchOne = getByTestId("autocomplete-suggestion-item-@user_1:host.local");
        const matchTwo = getByTestId("autocomplete-suggestion-item-@user_2:host.local");

        act(() => {
            fireEvent.mouseDown(matchOne);
        });

        act(() => {
            fireEvent.mouseDown(matchTwo);
        });

        // Check that `defaultUserLevel` is initially set and select a higher power level.
        expect((getByTestId("power-level-option-0") as HTMLOptionElement).selected).toBeTruthy();
        expect((getByTestId("power-level-option-50") as HTMLOptionElement).selected).toBeFalsy();
        expect((getByTestId("power-level-option-100") as HTMLOptionElement).selected).toBeFalsy();

        const powerLevelSelect = getByTestId("power-level-select-element");
        await userEvent.selectOptions(powerLevelSelect, "100");

        expect((getByTestId("power-level-option-0") as HTMLOptionElement).selected).toBeFalsy();
        expect((getByTestId("power-level-option-50") as HTMLOptionElement).selected).toBeFalsy();
        expect((getByTestId("power-level-option-100") as HTMLOptionElement).selected).toBeTruthy();

        // The submit button should be enabled now.
        expect(submitButton).toBeEnabled();

        // Submit the form.
        act(() => {
            fireEvent.submit(submitButton);
        });

        await waitFor(() => expect(mockClient.setPowerLevel).toHaveBeenCalledTimes(1));

        // Verify that the submit button is disabled again.
        expect(submitButton).toBeDisabled();

        // Verify that previously selected items are reset.
        const selectionItems = queryAllByTestId("autocomplete-selection-item", { exact: false });
        expect(selectionItems).toHaveLength(0);

        // Verify that power level select is reset to `defaultUserLevel`.
        expect((getByTestId("power-level-option-0") as HTMLOptionElement).selected).toBeTruthy();
        expect((getByTestId("power-level-option-50") as HTMLOptionElement).selected).toBeFalsy();
        expect((getByTestId("power-level-option-100") as HTMLOptionElement).selected).toBeFalsy();
    });

    it("getUserIdsFromCompletions() should map completions to user id's", () => {
        expect(getUserIdsFromCompletions(completions)).toStrictEqual(["@user_1:host.local", "@user_2:host.local"]);
    });

    it.each([
        { defaultUserLevel: -50, expectation: false },
        { defaultUserLevel: 0, expectation: true },
        { defaultUserLevel: 50, expectation: true },
    ])(
        "hasLowerOrEqualLevelThanDefaultLevel() should return $expectation for default level $defaultUserLevel",
        ({ defaultUserLevel, expectation }) => {
            expect(hasLowerOrEqualLevelThanDefaultLevel(room, completions[0], defaultUserLevel)).toBe(expectation);
        },
    );
});
