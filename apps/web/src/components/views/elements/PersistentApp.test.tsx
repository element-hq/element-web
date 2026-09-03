/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React, { createRef } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "test-utils-rtl";
import { type Room } from "matrix-js-sdk/src/matrix";
import { setUpClientRoomAndStores, cleanUpClientRoomAndStores, wrapInMatrixClientContext } from "test-utils";

import WidgetStore, { type IApp } from "../../../stores/WidgetStore";
import { WidgetType } from "../../../widgets/WidgetType";
import _PersistentApp from "./PersistentApp";

vi.mock("./AppTile", () => ({
    default: () => <div data-testid="app-tile" />,
}));
vi.mock("../voip/CallTile", () => ({
    CallTile: () => <div data-testid="call-tile" />,
}));

const PersistentApp = wrapInMatrixClientContext(_PersistentApp);

describe("PersistentApp", () => {
    let client: ReturnType<typeof setUpClientRoomAndStores>["client"];
    let room: Room;

    beforeEach(() => {
        ({ client, room } = setUpClientRoomAndStores());
    });

    afterEach(() => {
        cleanUpClientRoomAndStores(client, room);
    });

    const addWidget = (type: string): IApp =>
        WidgetStore.instance.addVirtualWidget(
            {
                id: `widget-${type}`,
                creatorUserId: "@alice:example.org",
                name: "Widget",
                type,
                url: "https://example.org",
            },
            room.roomId,
        );

    const renderApp = (app: IApp): void => {
        render(
            <PersistentApp
                persistentWidgetId={app.id}
                persistentRoomId={room.roomId}
                movePersistedElement={createRef<(() => void) | null>()}
            />,
        );
    };

    it("renders nothing for an unknown widget", () => {
        render(
            <PersistentApp
                persistentWidgetId="nope"
                persistentRoomId={room.roomId}
                movePersistedElement={createRef<(() => void) | null>()}
            />,
        );
        expect(screen.queryByTestId("app-tile")).not.toBeInTheDocument();
        expect(screen.queryByTestId("call-tile")).not.toBeInTheDocument();
    });

    it("renders an AppTile for ordinary widgets", () => {
        const app = addWidget(WidgetType.JITSI.preferred);
        renderApp(app);
        expect(screen.getByTestId("app-tile")).toBeInTheDocument();
        WidgetStore.instance.removeVirtualWidget(app.id, room.roomId);
    });

    it("lets CallTile pick the transport for Element Call widgets", () => {
        const app = addWidget(WidgetType.CALL.preferred);
        renderApp(app);
        expect(screen.getByTestId("call-tile")).toBeInTheDocument();
        WidgetStore.instance.removeVirtualWidget(app.id, room.roomId);
    });
});
