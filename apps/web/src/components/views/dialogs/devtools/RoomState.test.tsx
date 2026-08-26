/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { Room, PendingEventOrdering } from "matrix-js-sdk/src/matrix";
import { render } from "test-utils-rtl";
import { stubClient } from "test-utils";

import { RoomStateExplorer } from "./RoomState";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";
import { DevtoolsContext } from "./BaseTool";

describe("<RoomStateExplorer />", () => {
    beforeEach(() => {
        stubClient();
    });

    it("should render", () => {
        const cli = MatrixClientPeg.safeGet();
        const room = new Room("!roomId:example.com", cli, "@alice:example.com", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const { asFragment } = render(
            <MatrixClientContext.Provider value={cli}>
                <DevtoolsContext.Provider value={{ room }}>
                    <RoomStateExplorer onBack={() => {}} setTool={() => {}} />
                </DevtoolsContext.Provider>
            </MatrixClientContext.Provider>,
        );
        expect(asFragment()).toMatchSnapshot();
    });
});
