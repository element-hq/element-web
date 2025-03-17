/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen } from "jest-matrix-react";
import React, { type ComponentProps } from "react";
import userEvent from "@testing-library/user-event";

import { PowerLevelSelector } from "../../../../../src/components/views/settings/PowerLevelSelector";
import { stubClient } from "../../../../test-utils";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";

describe("PowerLevelSelector", () => {
    const matrixClient = stubClient();

    const currentUser = matrixClient.getUserId()!;
    const userLevels = {
        [currentUser]: 100,
        "@alice:server.org": 50,
        "@bob:server.org": 0,
    };

    const renderPLS = (props: Partial<ComponentProps<typeof PowerLevelSelector>>) =>
        render(
            <MatrixClientContext.Provider value={matrixClient}>
                <PowerLevelSelector
                    userLevels={userLevels}
                    canChangeLevels={true}
                    currentUserLevel={userLevels[currentUser]}
                    title="title"
                    // filter nothing by default
                    filter={() => true}
                    onClick={jest.fn()}
                    {...props}
                >
                    empty label
                </PowerLevelSelector>
            </MatrixClientContext.Provider>,
        );

    it("should render", () => {
        renderPLS({});
        expect(screen.getByRole("group")).toMatchSnapshot();
    });

    it("should display only the current user", async () => {
        // Display only the current user
        renderPLS({ filter: (user) => user === currentUser });

        // Only alice should be displayed
        const userSelects = screen.getAllByRole("combobox");
        expect(userSelects).toHaveLength(1);
        expect(userSelects[0]).toHaveAccessibleName(currentUser);

        expect(screen.getByRole("group")).toMatchSnapshot();
    });

    it("should be able to change the power level of the current user", async () => {
        const onClick = jest.fn();
        renderPLS({ onClick });

        // Until the power level is changed, the apply button should be disabled
        // compound button is using aria-disabled instead of the disabled attribute, we can't toBeDisabled on it
        expect(screen.getByRole("button", { name: "Apply" })).toHaveAttribute("aria-disabled", "true");

        const select = screen.getByRole("combobox", { name: currentUser });
        // Sanity check
        expect(select).toHaveValue("100");

        // Change current user power level to 50
        await userEvent.selectOptions(select, "50");
        expect(select).toHaveValue("50");
        // After the user level changes, the apply button should be enabled
        expect(screen.getByRole("button", { name: "Apply" })).toHaveAttribute("aria-disabled", "false");

        // Click on Apply should call onClick with the new power level
        await userEvent.click(screen.getByRole("button", { name: "Apply" }));
        expect(onClick).toHaveBeenCalledWith(50, currentUser);
    });

    it("should not be able to change the power level if `canChangeLevels` is false", async () => {
        renderPLS({ canChangeLevels: false });

        // The selects should be disabled
        const userSelects = screen.getAllByRole("combobox");
        userSelects.forEach((select) => expect(select).toBeDisabled());
    });

    it("should be able to change only the level of someone with a lower level", async () => {
        const userLevels = {
            [currentUser]: 50,
            "@alice:server.org": 100,
        };
        renderPLS({ userLevels });

        expect(screen.getByRole("combobox", { name: currentUser })).toBeEnabled();
        expect(screen.getByRole("combobox", { name: "@alice:server.org" })).toBeDisabled();
    });

    it("should display the children if there is no user to display", async () => {
        // No user to display
        renderPLS({ filter: () => false });

        expect(screen.getByText("empty label")).toBeInTheDocument();
    });
});
