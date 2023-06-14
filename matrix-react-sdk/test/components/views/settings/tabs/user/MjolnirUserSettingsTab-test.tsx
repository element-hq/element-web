/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import { render } from "@testing-library/react";

import { getMockClientWithEventEmitter, mockClientMethodsUser } from "../../../../../test-utils";
import MjolnirUserSettingsTab from "../../../../../../src/components/views/settings/tabs/user/MjolnirUserSettingsTab";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../../../../src/settings/SettingsStore";

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
