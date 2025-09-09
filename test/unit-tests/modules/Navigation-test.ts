/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import * as navigator from "../../../src/utils/permalinks/navigator";
import { NavigationApi } from "../../../src/modules/Navigation.ts";
import defaultDispatcher from "../../../src/dispatcher/dispatcher.ts";

describe("NavigationApi", () => {
    const api = new NavigationApi();

    describe("toMatrixToLink", () => {
        it.each([
            ["roomId", "https://matrix.to/#/!roomId:server.com"],
            ["roomAlias", "https://matrix.to/#/#alias:server.com"],
            ["user", "https://matrix.to/#/@user:server.com"],
        ])("should call navigateToPermalink with the correct parameters for %s", async (_type, link) => {
            const spy = jest.spyOn(navigator, "navigateToPermalink");

            await api.toMatrixToLink(link);
            expect(spy).toHaveBeenCalledWith(link);
        });

        it("should set auto_join to true when join=true", async () => {
            const link = "https://matrix.to/#/#alias:server.com?via=server.com";
            const spy = jest.spyOn(defaultDispatcher, "dispatch");

            await api.toMatrixToLink(link, true);
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: "view_room",
                    room_alias: "#alias:server.com",
                    auto_join: true,
                }),
            );
        });
    });
});
