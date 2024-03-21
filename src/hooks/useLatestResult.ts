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

import { useCallback, useRef } from "react";

/**
 * Hook to prevent a slower response to an earlier query overwriting the result to a faster response of a later query
 * @param onResultChanged
 */
export const useLatestResult = <T, R>(
    onResultChanged: (result: R) => void,
): [(query: T | null) => void, (query: T | null, result: R) => void] => {
    const ref = useRef<T | null>(null);
    const setQuery = useCallback((query: T | null) => {
        ref.current = query;
    }, []);
    const setResult = useCallback(
        (query: T | null, result: R) => {
            if (ref.current === query) {
                onResultChanged(result);
            }
        },
        [onResultChanged],
    );
    return [setQuery, setResult];
};
