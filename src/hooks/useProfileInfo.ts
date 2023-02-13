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

import { useCallback, useState } from "react";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { useLatestResult } from "./useLatestResult";

export interface IProfileInfoOpts {
    query?: string;
}

export interface IProfileInfo {
    user_id: string;
    avatar_url?: string;
    display_name?: string;
}

export const useProfileInfo = (): {
    ready: boolean;
    loading: boolean;
    profile: IProfileInfo | null;
    search(opts: IProfileInfoOpts): Promise<boolean>;
} => {
    const [profile, setProfile] = useState<IProfileInfo | null>(null);

    const [loading, setLoading] = useState(false);

    const [updateQuery, updateResult] = useLatestResult<string | undefined, IProfileInfo | null>(setProfile);

    const search = useCallback(
        async ({ query: term }: IProfileInfoOpts): Promise<boolean> => {
            updateQuery(term);
            if (!term?.length || !term.startsWith("@") || !term.includes(":")) {
                setProfile(null);
                return true;
            }

            setLoading(true);
            try {
                const result = await MatrixClientPeg.get().getProfileInfo(term);
                updateResult(term, {
                    user_id: term,
                    avatar_url: result.avatar_url,
                    display_name: result.displayname,
                });
                return true;
            } catch (e) {
                console.error("Could not fetch profile info for params", { term }, e);
                updateResult(term, null);
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
        profile,
        search,
    } as const;
};
