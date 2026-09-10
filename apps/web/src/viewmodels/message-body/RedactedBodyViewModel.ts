/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type RedactedBodyViewSnapshot,
    type RedactedBodyViewModel as RedactedBodyViewModelInterface,
} from "@element-hq/web-shared-components";

/**
 * View model for a redacted event body.
 *
 * All event inspection, localization, and settings access happens in the application adapter.
 */
export type RedactedBodyViewModelProps = RedactedBodyViewSnapshot;

export class RedactedBodyViewModel
    extends BaseViewModel<RedactedBodyViewSnapshot, RedactedBodyViewModelProps>
    implements RedactedBodyViewModelInterface
{
    public constructor(props: RedactedBodyViewModelProps) {
        super(props, props);
    }

    public setProps(props: RedactedBodyViewModelProps): void {
        this.props = props;
        this.snapshot.merge(props);
    }
}
