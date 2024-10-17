/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

const getUniqueId = (() => {
    return () => `:r${Math.random()}:`;
})();

// Replace this with React's own useId once we switch to React 18
export const useId = (): string => React.useMemo(getUniqueId, []);
