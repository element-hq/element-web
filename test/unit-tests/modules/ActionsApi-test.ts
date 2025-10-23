/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { waitFor } from "jest-matrix-react";

import { Action } from "../../../src/dispatcher/actions";
import dispatcher from "../../../src/dispatcher/dispatcher";
import { ActionsApi } from "../../../src/modules/ActionsApi";

describe("ActionsApi", () => {
    it("should dispatch view room action", async () => {
        const api = new ActionsApi();
        const fn = jest.fn();
        dispatcher.register(fn);
        api.openRoom("!foo:m.org");
        await waitFor(() =>
            expect(fn).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: "!foo:m.org",
            }),
        );
    });
});
