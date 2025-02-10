/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Dispatch, type SetStateAction, useState } from "react";

// Hook to simplify toggling of a boolean state value
// Returns value, method to toggle boolean value and method to set the boolean value
export const useStateToggle = (initialValue = false): [boolean, () => void, Dispatch<SetStateAction<boolean>>] => {
    const [value, setValue] = useState(initialValue);
    const toggleValue = (): void => {
        setValue(!value);
    };
    return [value, toggleValue, setValue];
};
