/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { Room, PendingEventOrdering } from "matrix-js-sdk/src/matrix";
import { render } from "test-utils-rtl";
import { stubClient } from "test-utils";

import RoomNotifications from "./RoomNotifications";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { DevtoolsContext } from "./BaseTool";

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
