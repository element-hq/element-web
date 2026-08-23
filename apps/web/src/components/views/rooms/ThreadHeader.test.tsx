/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { test, describe, beforeEach, expect, vi } from "vitest";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import { ThreadHeader } from "./ThreadHeader";
import { getMockClientWithEventEmitter, mkStubRoom, mockClientMethodsUser } from "../../../../test/test-utils";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import DMRoomMap from "../../../utils/DMRoomMap";

// @vitest-environment happy-dom

describe("<ThreadHeader />", () => {
    const userId = "@alice:server.org";
    let client: MatrixClient;
    let room: Room;

    beforeEach(() => {
        client = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(userId),
            getRoom: vi.fn(),
        });
        room = mkStubRoom("!room:server.org", "Github", client);
        (client.getRoom as unknown as ReturnType<typeof vi.fn>).mockReturnValue(room);
        DMRoomMap.setShared({
            getUserIdForRoomId: vi.fn(),
        } as unknown as DMRoomMap);
    });

    const renderHeader = (onBack = vi.fn()) => {
        render(
            <MatrixClientContext.Provider value={client}>
                <ThreadHeader room={room} onBack={onBack} />
            </MatrixClientContext.Provider>,
        );
        return onBack;
    };

    test("identifies the thread and the room it belongs to", () => {
        renderHeader();

        expect(screen.getByText("Thread")).toBeInTheDocument();
        expect(screen.getByText("Github")).toBeInTheDocument();
    });

    test("exposes the thread and its room as a single heading to assistive technology", () => {
        renderHeader();

        expect(screen.getByRole("heading", { name: "Thread in Github" })).toBeInTheDocument();
    });

    test("offers leaving the thread as the only action", async () => {
        const onBack = renderHeader();

        const buttons = screen.getAllByRole("button");
        expect(buttons).toHaveLength(1);

        await userEvent.click(buttons[0]);
        expect(onBack).toHaveBeenCalled();
    });
});
