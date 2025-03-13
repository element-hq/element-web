/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import UIStore, { UI_EVENTS } from "../stores/UIStore";

/**
 * Hook that gets the width of the viewport using UIStore
 *
 * @returns the current window width
 */
export const useWindowWidth = (): number => {
    const [width, setWidth] = React.useState(UIStore.instance.windowWidth);

    React.useEffect(() => {
        UIStore.instance.on(UI_EVENTS.Resize, () => {
            setWidth(UIStore.instance.windowWidth);
        });

        return () => {
            UIStore.instance.removeListener(UI_EVENTS.Resize, () => {
                setWidth(UIStore.instance.windowWidth);
            });
        };
    }, []);

    return width;
};
