/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { useCallback, useState } from "react";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { DirectoryMember } from "../utils/direct-messages";
import { useLatestResult } from "./useLatestResult";
import { ModuleRunner } from "../modules/ModuleRunner";
import { SdkContextClass } from "../contexts/SDKContext";

export interface IUserDirectoryOpts {
    limit: number;
    query: string;
}

export const useUserDirectory = (): {
    ready: boolean;
    loading: boolean;
    users: DirectoryMember[];
    search(opts: IUserDirectoryOpts): Promise<boolean>;
} => {
    const [users, setUsers] = useState<DirectoryMember[]>([]);

    const [loading, setLoading] = useState(false);

    const [updateQuery, updateResult] = useLatestResult<{ term: string; limit?: number }, DirectoryMember[]>(setUsers);

    const search = useCallback(
        async ({ limit = 20, query: term }: IUserDirectoryOpts): Promise<boolean> => {
            const opts = { limit, term };
            updateQuery(opts);

            if (!term?.length) {
                setUsers([]);
                return true;
            }

            try {
                setLoading(true);
                const client = MatrixClientPeg.safeGet();
                const searchContext = await ModuleRunner.instance.extensions.userSearch.getSearchContext(
                    client,
                    SdkContextClass.instance,
                );
                const { results } = await client.searchUserDirectory(
                    opts,
                    searchContext.extraBodyArgs,
                    searchContext.extraRequestOptions,
                );

                updateResult(
                    opts,
                    results.map((user) => new DirectoryMember(user)),
                );
                return true;
            } catch (e) {
                console.error("Could not fetch user in user directory for params", { limit, term }, e);
                updateResult(opts, []);
                return false;
            } finally {
                setLoading(false);
            }
        },
        [updateQuery, updateResult],
    );

    return {
        ready: true,
        loading,
        users,
        search,
    } as const;
};
