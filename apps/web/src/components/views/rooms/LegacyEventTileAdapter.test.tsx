/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render } from "test-utils-rtl";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { LegacyEventTileAdapter } from "./LegacyEventTileAdapter";
import { Layout } from "../../../settings/enums/Layout";
import EditorStateTransfer from "../../../utils/EditorStateTransfer";
import { mkMessage, stubClient } from "../../../../test/test-utils";

// The tile itself is exercised by its own tests; here we only care about what the
// adapter hands it, so stand in a stub that records the props it received.
const { tileProps } = vi.hoisted(() => ({ tileProps: { current: null as Record<string, unknown> | null } }));

vi.mock("./EventTile", async () => {
    const actual = await vi.importActual<typeof import("./EventTile")>("./EventTile");
    return {
        ...actual,
        default: (props: Record<string, unknown>) => {
            tileProps.current = props;
            return <div data-testid="event-tile" />;
        },
    };
});

describe("<LegacyEventTileAdapter />", () => {
    const ROOM_ID = "!room:example.org";
    let event: MatrixEvent;

    beforeEach(() => {
        stubClient();
        tileProps.current = null;
        event = mkMessage({ room: ROOM_ID, user: "@alice:example.org", msg: "hello", event: true });
    });

    it("renders the tile as a div, because the timeline supplies the list item", () => {
        render(<LegacyEventTileAdapter mxEvent={event} />);

        expect(tileProps.current?.as).toBe("div");
        expect(tileProps.current?.mxEvent).toBe(event);
    });

    it("always asks for the compact reply preview", () => {
        render(<LegacyEventTileAdapter mxEvent={event} />);

        expect(tileProps.current?.compactReplyPreview).toBe(true);
    });

    it("passes the row's display options through to the tile", () => {
        const permalinkCreator = {} as never;
        const getRelationsForEvent = vi.fn();

        render(
            <LegacyEventTileAdapter
                mxEvent={event}
                continuation={true}
                lastInSection={true}
                isSelectedEvent={true}
                layout={Layout.Bubble}
                showReactions={true}
                showUrlPreview={true}
                isTwelveHour={true}
                alwaysShowTimestamps={true}
                permalinkCreator={permalinkCreator}
                getRelationsForEvent={getRelationsForEvent}
            />,
        );

        expect(tileProps.current).toMatchObject({
            continuation: true,
            lastInSection: true,
            isSelectedEvent: true,
            layout: Layout.Bubble,
            showReactions: true,
            showUrlPreview: true,
            isTwelveHour: true,
            alwaysShowTimestamps: true,
            permalinkCreator,
            getRelationsForEvent,
        });
    });

    it("passes the edit state on when the row is the one being edited", () => {
        const editState = new EditorStateTransfer(event);

        render(<LegacyEventTileAdapter mxEvent={event} editState={editState} />);

        expect(tileProps.current?.editState).toBe(editState);
    });

    it("leaves the edit state off rows that are not being edited", () => {
        render(<LegacyEventTileAdapter mxEvent={event} />);

        expect(tileProps.current?.editState).toBeUndefined();
    });
});
