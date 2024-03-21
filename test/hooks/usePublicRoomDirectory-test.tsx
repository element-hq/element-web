/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { waitFor } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react-hooks/dom";
import { IRoomDirectoryOptions, MatrixClient } from "matrix-js-sdk/src/matrix";

import { usePublicRoomDirectory } from "../../src/hooks/usePublicRoomDirectory";
import { MatrixClientPeg } from "../../src/MatrixClientPeg";
import { stubClient } from "../test-utils/test-utils";

function render() {
    return renderHook(() => usePublicRoomDirectory());
}

describe("usePublicRoomDirectory", () => {
    let cli: MatrixClient;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();

        MatrixClientPeg.getHomeserverName = () => "matrix.org";
        cli.getThirdpartyProtocols = () => Promise.resolve({});
        cli.publicRooms = ({ filter }: IRoomDirectoryOptions) => {
            const chunk = filter?.generic_search_term
                ? [
                      {
                          room_id: "hello world!",
                          name: filter.generic_search_term,
                          world_readable: true,
                          guest_can_join: true,
                          num_joined_members: 1,
                      },
                  ]
                : [];
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
