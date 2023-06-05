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
import { Room } from "matrix-js-sdk/src/models/room";
import { PendingEventOrdering } from "matrix-js-sdk/src/client";

import RoomNotifications from "../../../../../src/components/views/dialogs/devtools/RoomNotifications";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { stubClient } from "../../../../test-utils";
import { DevtoolsContext } from "../../../../../src/components/views/dialogs/devtools/BaseTool";

describe("<RoomNotifications />", () => {
    beforeEach(() => {
        stubClient();
    });

    it("should render", () => {
        const cli = MatrixClientPeg.safeGet();
        const { asFragment } = render(
            <MatrixClientContext.Provider value={cli}>
                <DevtoolsContext.Provider
                    value={{
                        room: new Room("!roomId", cli, "@alice:example.com", {
                            pendingEventOrdering: PendingEventOrdering.Detached,
                        }),
                    }}
                >
                    <RoomNotifications onBack={() => {}} setTool={() => {}} />
                </DevtoolsContext.Provider>
            </MatrixClientContext.Provider>,
        );
        expect(asFragment()).toMatchSnapshot();
    });
});
