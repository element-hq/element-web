/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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
