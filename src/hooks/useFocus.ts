/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useState } from "react";

export default function useFocus(): [boolean, { onFocus: () => void; onBlur: () => void }] {
    const [focused, setFocused] = useState(false);

    const props = {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
    };

    return [focused, props];
}
