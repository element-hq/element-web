/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "jest-matrix-react";

import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import { TimelinePanelView } from "../../../../src/components/structures/TimelinePanelView";

jest.mock("@element-hq/web-shared-components", () => {
    const actual = jest.requireActual("@element-hq/web-shared-components");
    return {
        ...actual,
        TimelineView: ({ vm, renderItem }: any) => (
            <div data-testid="timeline-view">{vm.getSnapshot().items.map((item: any) => renderItem(item))}</div>
        ),
        DateSeparatorView: ({ vm, className }: any) => (
            <div data-testid="date-separator" className={className}>
                separator:{vm.props.roomId}:{vm.props.ts}
            </div>
        ),
    };
});

jest.mock("../../../../src/viewmodels/room/timeline/TimelinePanelViewModel", () => ({
    TimelinePanelViewModel: jest.fn().mockImplementation(() => ({
        getSnapshot: () => ({
            items: [
                {
                    key: "date-row",
                    kind: "date-separator",
                    vm: {
                        props: { roomId: "!room:example.org", ts: 1712563200000 },
                        getSnapshot: () => ({ label: "ignored" }),
                        subscribe: () => () => {},
                    },
                },
            ],
        }),
        subscribe: () => () => {},
    })),
}));

describe("TimelinePanelView", () => {
    it("renders date separators from the timeline row view model instead of the raw item key", () => {
        const room = {
            roomId: "!room:example.org",
        } as any;
        const client = {} as any;

        render(
            <MatrixClientContext.Provider value={client}>
                <TimelinePanelView room={room} />
            </MatrixClientContext.Provider>,
        );

        expect(screen.getByTestId("date-separator")).toHaveTextContent("separator:!room:example.org:1712563200000");
        expect(screen.queryByText("date-row")).not.toBeInTheDocument();
    });
});
