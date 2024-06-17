/*
Copyright 2023 Mikhail Aheichyk
Copyright 2023 Nordeck IT + Consulting GmbH.

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
import { render, screen } from "@testing-library/react";

import HomePage from "../../../src/components/structures/HomePage";
import SettingsStore from "../../../src/settings/SettingsStore";
import { getMockClientWithEventEmitter, mockClientMethodsEvents, mockClientMethodsUser } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";

jest.mock("../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

describe("HomePage", () => {
    const userId = "@me:here";
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsEvents(),
        getAccountData: jest.fn(),
        isUserIgnored: jest.fn().mockReturnValue(false),
        isRoomEncrypted: jest.fn().mockReturnValue(false),
        getRoom: jest.fn(),
        getClientWellKnown: jest.fn().mockReturnValue({}),
        supportsThreads: jest.fn().mockReturnValue(true),
        getUserId: jest.fn(),
    });

    jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(client);

    client.getUserId.mockReturnValue("123");

    it("shows the Welcome screen buttons when feature is true", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);

        client.getUserId.mockReturnValue("123");
        render(<HomePage justRegistered={false} />);

        expect(screen.findAllByText("onboarding")).toBeTruthy();
        expect(screen.queryAllByRole("button", { name: /onboarding/i })).toBeTruthy();
    });
    it("does not show the Welcome screen buttons when feature is false", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);

        client.getUserId.mockReturnValue("123");

        render(<HomePage justRegistered={false} />);

        expect(screen.queryByText("onboarding")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /onboarding/i })).not.toBeInTheDocument();
    });
});
