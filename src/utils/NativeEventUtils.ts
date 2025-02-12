/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type React from "react";

// Wrap DOM event handlers with stopPropagation and preventDefault
export const preventDefaultWrapper =
    <T extends React.BaseSyntheticEvent = React.BaseSyntheticEvent>(callback: () => void) =>
    (e?: T) => {
        e?.stopPropagation();
        e?.preventDefault();
        callback();
    };
