/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { vi, describe, it, expect, afterAll, beforeEach } from "vitest";
import { render, screen } from "test-utils-rtl";
import { Room, type MatrixClient } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";

import { stubClient } from "../../../../test/test-utils";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import DevtoolsDialog from "./DevtoolsDialog";

describe("DevtoolsDialog", () => {
    let cli: MatrixClient;
    let room: Room;

    function getComponent(roomId: string, threadRootId: string | null = null, onFinished = () => true) {
        return render(
            <MatrixClientContext.Provider value={cli}>
                <DevtoolsDialog roomId={roomId} threadRootId={threadRootId} onFinished={onFinished} />
            </MatrixClientContext.Provider>,
        );
    }

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        room = new Room("!id", cli, "@alice:matrix.org");

        vi.spyOn(cli, "getRoom").mockReturnValue(room);
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    it("renders the devtools dialog", () => {
        const { asFragment } = getComponent(room.roomId);
        expect(asFragment()).toMatchSnapshot();
    });

    it("copies the roomid", async () => {
        const user = userEvent.setup();
        vi.spyOn(navigator.clipboard, "writeText");

        getComponent(room.roomId);

        const copyBtn = screen.getByLabelText("Copy");
        await user.click(copyBtn);
        const copiedBtn = screen.getByLabelText("Copied!");

        expect(copiedBtn).toBeInTheDocument();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(room.roomId);
    });

    it("copies the thread root id when provided", async () => {
        const user = userEvent.setup();
        vi.spyOn(navigator.clipboard, "writeText");

        const threadRootId = "$test_event_id_goes_here";
        getComponent(room.roomId, threadRootId);

        const copyBtn = screen.getAllByLabelText("Copy")[1];
        await user.click(copyBtn);
        const copiedBtn = screen.getByLabelText("Copied!");

        expect(copiedBtn).toBeInTheDocument();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(threadRootId);
    });
});
