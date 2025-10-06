/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RoomViewProps, type BuiltinsApi } from "@element-hq/element-web-module-api";

import { RoomView } from "../components/structures/RoomView";

export class ElementWebBuiltinsApi implements BuiltinsApi {
    public getRoomViewComponent(): React.ComponentType<RoomViewProps> {
        return RoomView;
    }
}
