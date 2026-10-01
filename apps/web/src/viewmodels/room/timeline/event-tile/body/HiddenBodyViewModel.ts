/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type HiddenBodyViewModel as HiddenBodyViewModelInterface,
    type HiddenBodyViewSnapshot,
} from "@element-hq/web-shared-components";

export interface HiddenBodyViewModelProps {
    /**
     * The hidden event being rendered.
     */
    mxEvent: MatrixEvent;
}

/**
 * ViewModel for messages hidden pending moderation.
 */
export class HiddenBodyViewModel
    extends BaseViewModel<HiddenBodyViewSnapshot, HiddenBodyViewModelProps>
    implements HiddenBodyViewModelInterface
{
    private static readonly computeSnapshot = ({ mxEvent }: HiddenBodyViewModelProps): HiddenBodyViewSnapshot => {
        const visibility = mxEvent.messageVisibility();

        if (visibility.visible) {
            throw new Error("HiddenBodyViewModel should only be applied to hidden messages");
        }

        return {
            reason: visibility.reason || undefined,
        };
    };

    public constructor(props: HiddenBodyViewModelProps) {
        super(props, HiddenBodyViewModel.computeSnapshot(props));
    }

    public setEvent(mxEvent: MatrixEvent): void {
        this.props.mxEvent = mxEvent;
        this.snapshot.merge(HiddenBodyViewModel.computeSnapshot(this.props));
    }
}
