/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { Room, PendingEventOrdering } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";
import { stubClient } from "../../../../../test-utils";
import { DevtoolsContext } from "../../../../../../src/components/views/dialogs/devtools/BaseTool";
import { TimelineEventEditor } from "../../../../../../src/components/views/dialogs/devtools/Event";

describe("<EventEditor />", () => {
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
                    <TimelineEventEditor onBack={() => {}} />
                </DevtoolsContext.Provider>
            </MatrixClientContext.Provider>,
        );
        expect(asFragment()).toMatchSnapshot();
    });

    describe("thread context", () => {
        it("should pre-populate a thread relationship", () => {
            const cli = MatrixClientPeg.safeGet();
            const { asFragment } = render(
                <MatrixClientContext.Provider value={cli}>
                    <DevtoolsContext.Provider
                        value={{
                            room: new Room("!roomId", cli, "@alice:example.com", {
                                pendingEventOrdering: PendingEventOrdering.Detached,
                            }),
                            threadRootId: "$this_is_a_thread_id",
                        }}
                    >
                        <TimelineEventEditor onBack={() => {}} />
                    </DevtoolsContext.Provider>
                </MatrixClientContext.Provider>,
            );
            expect(asFragment()).toMatchSnapshot();
        });
    });
});
