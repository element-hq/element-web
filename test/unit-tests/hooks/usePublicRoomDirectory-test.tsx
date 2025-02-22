/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { waitFor, renderHook, act } from "jest-matrix-react";
import { type IRoomDirectoryOptions, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { usePublicRoomDirectory } from "../../../src/hooks/usePublicRoomDirectory";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { stubClient } from "../../test-utils/test-utils";

function render() {
    return renderHook(() => usePublicRoomDirectory());
}

describe("usePublicRoomDirectory", () => {
    let cli: MatrixClient;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();

        cli.getDomain = () => "matrix.org";
        cli.getThirdpartyProtocols = () => Promise.resolve({});
        cli.publicRooms = ({ filter }: IRoomDirectoryOptions) => {
            const chunk = [
                {
                    room_id: "hello world!",
                    name: filter?.generic_search_term ?? "", // If the query is "" no filter is applied(an is undefined here), in keeping with the pattern let's call the room ""
                    world_readable: true,
                    guest_can_join: true,
                    num_joined_members: 1,
                },
            ];
            return Promise.resolve({
                chunk,
                total_room_count_estimate: 1,
            });
        };
    });

    it("should display public rooms when searching", async () => {
        const query = "ROOM NAME";
        const { result } = render();

        expect(result.current.ready).toBe(false);
        expect(result.current.loading).toBe(false);

        act(() => {
            result.current.search({
                limit: 1,
                query,
            });
        });

        await waitFor(() => {
            expect(result.current.ready).toBe(true);
        });

        expect(result.current.publicRooms[0].name).toBe(query);
    });

    it("should work with empty queries", async () => {
        const query = "";
        const { result } = render();

        act(() => {
            result.current.search({
                limit: 1,
                query,
            });
        });

        await waitFor(() => {
            expect(result.current.ready).toBe(true);
        });

        expect(result.current.publicRooms[0].name).toEqual(query);
    });

    it("should recover from a server exception", async () => {
        cli.publicRooms = () => {
            throw new Error("Oops");
        };
        const query = "ROOM NAME";

        const { result } = render();

        act(() => {
            result.current.search({
                limit: 1,
                query,
            });
        });

        await waitFor(() => {
            expect(result.current.ready).toBe(true);
        });

        expect(result.current.publicRooms).toEqual([]);
    });
});
