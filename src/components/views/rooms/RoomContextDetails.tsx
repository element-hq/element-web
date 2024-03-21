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

import { Room } from "matrix-js-sdk/src/matrix";
import React, { HTMLAttributes, ReactHTML } from "react";

import { roomContextDetails } from "../../../utils/i18n-helpers";

type Props<T extends keyof ReactHTML> = HTMLAttributes<T> & {
    component?: T;
    room: Room;
};

export function RoomContextDetails<T extends keyof ReactHTML>({ room, component, ...other }: Props<T>): JSX.Element {
    const contextDetails = roomContextDetails(room);
    if (contextDetails) {
        return React.createElement(
            component ?? "div",
            {
                ...other,
                "aria-label": contextDetails.ariaLabel,
            },
            [contextDetails.details],
        );
    }

    return <></>;
}
