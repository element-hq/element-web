/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    type CommonOngoingCallTileViewAction,
    type DmOngoingCallTileViewSnapshot,
} from "@element-hq/web-shared-components";

import { type Props, BaseOngoingCallViewModel } from "./BaseOngoingCallTileViewModel";
import { getIntentFromEvent } from "../../common";

/**
 * View model for an ongoing call in a DM room.
 */
export class DmOngoingCallTileViewModel
    extends BaseOngoingCallViewModel<DmOngoingCallTileViewSnapshot>
    implements CommonOngoingCallTileViewAction
{
    public constructor(props: Props) {
        const callType = getIntentFromEvent(props.mxEvent);
        super(props, { callType });
    }
}
