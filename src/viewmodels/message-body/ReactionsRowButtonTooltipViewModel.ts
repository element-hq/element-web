/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    DecryptionFailureReason,
    type DecryptionFailureBodyViewSnapshot as DecryptionFailureBodyViewSnapshotInterface,
    type DecryptionFailureBodyViewModel as DecryptionFailureBodyViewModelInterface,
} from "@element-hq/web-shared-components";

export interface DecryptionFailureBodyViewModelProps {
    /**
     * The message event being rendered.
     */
    mxEvent: MatrixEvent;
    /**
     * The local device verification state.
     */
    verificationState?: boolean;
    /**
     * Custom CSS class to apply to the component
     */
    className?: string;
}

/**
 * ViewModel for the decryption failure body, providing the current state of the component.
 */
export class DecryptionFailureBodyViewModel
    extends BaseViewModel<DecryptionFailureBodyViewSnapshotInterface, DecryptionFailureBodyViewModelProps>
    implements DecryptionFailureBodyViewModelInterface
{
    /**
     * @param mxEvent - The message event being rendered
     * @param verificationState - The local device verification state
     * @param className - Custom CSS class to apply to the component
     */
    private static readonly computeSnapshot = (
        mxEvent: MatrixEvent,
        verificationState?: boolean,
        className?: string,
    ): DecryptionFailureBodyViewSnapshotInterface => {
        //Convert enum DecryptionFailureCode to enum DecryptionFailureReason
        const failureReason =
            mxEvent.decryptionFailureReason == null
                ? null
                : (Object.values(DecryptionFailureReason) as string[]).includes(
                        mxEvent.decryptionFailureReason.toString(),
                    )
                  ? (mxEvent.decryptionFailureReason.toString() as DecryptionFailureReason)
                  : DecryptionFailureReason.UNKNOWN_ERROR;

        return {
            decryptionFailureReason: failureReason,
            isLocalDeviceVerified: verificationState,
            className,
        };
    };

    public constructor(props: DecryptionFailureBodyViewModelProps) {
        super(
            props,
            DecryptionFailureBodyViewModel.computeSnapshot(props.mxEvent, props.verificationState, props.className),
        );
    }

    /**
     * Sets the snapshot and emits an update to subscribers.
     */
    private readonly setSnapshot = (): void => {
        this.snapshot.set(
            DecryptionFailureBodyViewModel.computeSnapshot(
                this.props.mxEvent,
                this.props.verificationState,
                this.props.className,
            ),
        );
    };

    /**
     * Updates the properties of the view model and recomputes the snapshot.
     * @param newProps
     */
    public setProps(newProps: Partial<DecryptionFailureBodyViewModelProps>): void {
        this.props = { ...this.props, ...newProps };
        this.setSnapshot();
    }
}