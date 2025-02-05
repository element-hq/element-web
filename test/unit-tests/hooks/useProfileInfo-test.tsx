/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { waitFor, renderHook, act } from "jest-matrix-react";
import { type EmptyObject, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { useProfileInfo } from "../../../src/hooks/useProfileInfo";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { stubClient } from "../../test-utils/test-utils";

function render() {
    return renderHook(() => useProfileInfo());
}

describe("useProfileInfo", () => {
    let cli: MatrixClient;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        cli.getProfileInfo = (query) => {
            return Promise.resolve({
                avatar_url: undefined,
                displayname: query,
            });
        };
    });

    it("should display user profile when searching", async () => {
        const query = "@user:home.server";

        const { result } = render();

        act(() => {
            result.current.search({ query });
        });

        await waitFor(() => expect(result.current.ready).toBe(true));

        expect(result.current.profile?.display_name).toBe(query);
    });

    it("should work with empty queries", async () => {
        const query = "";

        const { result } = render();

        act(() => {
            result.current.search({ query });
        });

        await waitFor(() => expect(result.current.ready).toBe(true));

        expect(result.current.profile).toBeNull();
    });

    it("should treat invalid mxids as empty queries", async () => {
        const queries = ["@user", "user@home.server"];

        for (const query of queries) {
            const { result } = render();

            act(() => {
                result.current.search({ query });
            });

            await waitFor(() => expect(result.current.ready).toBe(true));

            expect(result.current.profile).toBeNull();
        }
    });

    it("should recover from a server exception", async () => {
        cli.getProfileInfo = () => {
            throw new Error("Oops");
        };
        const query = "@user:home.server";

        const { result } = render();

        act(() => {
            result.current.search({ query });
        });

        await waitFor(() => expect(result.current.ready).toBe(true));

        expect(result.current.profile).toBeNull();
    });

    it("should be able to handle an empty result", async () => {
        cli.getProfileInfo = () => null as unknown as Promise<EmptyObject>;
        const query = "@user:home.server";

        const { result } = render();

        act(() => {
            result.current.search({ query });
        });

        await waitFor(() => expect(result.current.ready).toBe(true));

        expect(result.current.profile?.display_name).toBeUndefined();
    });
});
