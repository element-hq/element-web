/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    BaseViewModel,
    type MjolnirBodyViewModel as MjolnirBodyViewModelInterface,
    type MjolnirBodyViewSnapshot,
} from "@element-hq/web-shared-components";

export interface MjolnirBodyViewModelProps {
    /** Invoked when the user chooses to show the hidden event. */
    onAllow: () => void;
}

/**
 * ViewModel for Mjolnir-hidden message bodies.
 */
export class MjolnirBodyViewModel
    extends BaseViewModel<MjolnirBodyViewSnapshot, MjolnirBodyViewModelProps>
    implements MjolnirBodyViewModelInterface
{
    private static readonly computeSnapshot = (): MjolnirBodyViewSnapshot => ({});

    public constructor(props: MjolnirBodyViewModelProps) {
        super(props, MjolnirBodyViewModel.computeSnapshot());
    }

    public setProps(props: MjolnirBodyViewModelProps): void {
        this.props = props;
    }

    public onAllow = (): void => {
        this.props.onAllow();
    };
}
