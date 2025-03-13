/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useState } from "react";

export default function useHover(
    ignoreHover: (ev: React.MouseEvent) => boolean,
): [boolean, { onMouseOver: () => void; onMouseLeave: () => void; onMouseMove: (ev: React.MouseEvent) => void }] {
    const [hovered, setHoverState] = useState(false);

    const props = {
        onMouseOver: () => setHoverState(true),
        onMouseLeave: () => setHoverState(false),
        onMouseMove: (ev: React.MouseEvent): void => {
            setHoverState(!ignoreHover(ev));
        },
    };

    return [hovered, props];
}
