/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { render, screen } from "test-utils-rtl";
import { createTestClient } from "test-utils";
import userEvent from "@testing-library/user-event";
import { EventType } from "matrix-js-sdk/src/matrix";
import { vi, describe, it, expect } from "vitest";

import { UnpinAllDialog } from "./UnpinAllDialog";

describe("<UnpinAllDialog />", () => {
    const client = createTestClient();
    const roomId = "!room:example.org";

    function renderDialog(onFinished = vi.fn()) {
        return render(<UnpinAllDialog matrixClient={client} roomId={roomId} onFinished={onFinished} />);
    }

    it("should render", () => {
        const { asFragment } = renderDialog();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should remove all pinned events when clicked on Continue", async () => {
        const onFinished = vi.fn();
        renderDialog(onFinished);

        await userEvent.click(screen.getByText("Continue"));
        expect(client.sendStateEvent).toHaveBeenCalledWith(roomId, EventType.RoomPinnedEvents, { pinned: [] }, "");
        expect(onFinished).toHaveBeenCalled();
    });
});
