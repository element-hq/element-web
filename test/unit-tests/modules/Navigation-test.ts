/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";

import * as navigator from "../../../src/utils/permalinks/navigator";
import { NavigationApi } from "../../../src/modules/Navigation.ts";
import { stubClient } from "../../test-utils";
import defaultDispatcher from "../../../src/dispatcher/dispatcher.ts";

describe("NavigationApi", () => {
    const api = new NavigationApi();

    describe("toMatrixToLink", () => {
        it("should call navigateToPermalink with the correct parameters", async () => {
            const link = "https://matrix.to/#/!roomId:server.com";
            const spy = jest.spyOn(navigator, "navigateToPermalink");

            await api.toMatrixToLink(link);
            expect(spy).toHaveBeenCalledWith(link);
        });

        it("should resolve the room alias to a room id when join=true", async () => {
            const cli = stubClient();
            mocked(cli.getRoomIdForAlias).mockResolvedValue({ room_id: "!roomId:server.com", servers: [] });

            const link = "https://matrix.to/#/#alias:server.com";
            const spy = jest.spyOn(defaultDispatcher, "dispatch");

            await api.toMatrixToLink(link, true);
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: "join_room",
                    roomId: "!roomId:server.com",
                }),
            );
        });
    });
});
