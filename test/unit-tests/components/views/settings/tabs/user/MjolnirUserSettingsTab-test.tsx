/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../../../test-utils";
import MjolnirUserSettingsTab from "../../../../../../../src/components/views/settings/tabs/user/MjolnirUserSettingsTab";
import MatrixClientContext from "../../../../../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../../../../../src/settings/SettingsStore";

describe("<MjolnirUserSettingsTab />", () => {
    const userId = "@alice:server.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        getRoom: jest.fn(),
    });

    const getComponent = () =>
        render(<MjolnirUserSettingsTab />, {
            wrapper: ({ children }) => (
                <MatrixClientContext.Provider value={mockClient}>{children}</MatrixClientContext.Provider>
            ),
        });

    it("renders correctly when user has no ignored users", () => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(null);
        const { container } = getComponent();

        expect(container).toMatchSnapshot();
    });
});
