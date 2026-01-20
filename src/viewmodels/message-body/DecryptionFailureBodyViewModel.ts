/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type DecryptionFailureBodyViewSnapshot,
    type DecryptionFailureBodyViewModel as DecryptionFailureBodyViewModelInterface,
} from "@element-hq/web-shared-components";

/**
 * ViewModel for the decryption failure body, providing the current state of the component.
 */
export class DecryptionFailureBodyViewModel
    extends BaseViewModel<DecryptionFailureBodyViewSnapshot, DecryptionFailureBodyViewSnapshot>
    implements DecryptionFailureBodyViewModelInterface
{
    /**
     * @param mxEvent - The message event being rendered
     * @param ref - React ref to attach to any React components returned
     * @param className - CSS class to apply to the component
     */
    private static readonly computeSnapshot = (
        mxEvent: MatrixEvent,
        ref?: React.RefObject<any>,
        className?: string,
    ): DecryptionFailureBodyViewSnapshot => {
        return {
            mxEvent,
            ref,
            className,
        };
    };

    public constructor(props: DecryptionFailureBodyViewSnapshot) {
        super(props, DecryptionFailureBodyViewModel.computeSnapshot(props.mxEvent, props.ref, props.className));
    }

    /**
     * Sets the snapshot and emits an update to subscribers.
     */
    private readonly setSnapshot = (): void => {
        this.snapshot.set(
            DecryptionFailureBodyViewModel.computeSnapshot(this.props.mxEvent, this.props.ref, this.props.className),
        );
    };

    /**
     * Updates the properties of the view model and recomputes the snapshot.
     * @param newProps
     */
    public setProps(newProps: Partial<DecryptionFailureBodyViewSnapshot>): void {
        this.props = { ...this.props, ...newProps };
        this.setSnapshot();
    }
}
