/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { DecryptionFailureCode } from "matrix-js-sdk/src/crypto-api";
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
    decryptionFailureCode: DecryptionFailureCode | null;
    /**
     * The local device verification state.
     */
    verificationState?: boolean;
    /**
     * Extra CSS classes to apply to the component
     */
    extraClassNames?: string[];
}

/**
 * ViewModel for the decryption failure body, providing the current state of the component.
 */
export class DecryptionFailureBodyViewModel
    extends BaseViewModel<DecryptionFailureBodyViewSnapshotInterface, DecryptionFailureBodyViewModelProps>
    implements DecryptionFailureBodyViewModelInterface
{
    /**
     * Convert enum DecryptionFailureCode to enum DecryptionFailureReason.
     */
    private static getDecryptionReasonFromCode(
        decryptionFailureCode: DecryptionFailureCode | null,
    ): DecryptionFailureReason {
        switch (decryptionFailureCode) {
            case DecryptionFailureCode.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED:
                return DecryptionFailureReason.HISTORICAL_MESSAGE_BACKUP_UNCONFIGURED;
            case DecryptionFailureCode.HISTORICAL_MESSAGE_NO_KEY_BACKUP:
                return DecryptionFailureReason.HISTORICAL_MESSAGE_NO_KEY_BACKUP;
            case DecryptionFailureCode.HISTORICAL_MESSAGE_USER_NOT_JOINED:
                return DecryptionFailureReason.HISTORICAL_MESSAGE_USER_NOT_JOINED;
            case DecryptionFailureCode.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE:
                return DecryptionFailureReason.MEGOLM_KEY_WITHHELD_FOR_UNVERIFIED_DEVICE;
            case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
                return DecryptionFailureReason.SENDER_IDENTITY_PREVIOUSLY_VERIFIED;
            case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
                return DecryptionFailureReason.UNSIGNED_SENDER_DEVICE;
            default:
                return DecryptionFailureReason.UNABLE_TO_DECRYPT;
        }
    }

    /**
     * @param mxEvent - The message event being rendered
     * @param verificationState - The local device verification state
     * @param className - Custom CSS class to apply to the component
     */
    private static readonly computeSnapshot = (
        decryptionFailureCode: DecryptionFailureCode | null,
        verificationState?: boolean,
        extraClassNames?: string[],
    ): DecryptionFailureBodyViewSnapshotInterface => {
        // Keep mx_DecryptionFailureBody and mx_EventTile_content to support the compatibility with existing timeline and the all the layout
        const defaultClassNames = ["mx_DecryptionFailureBody", "mx_EventTile_content"];
        return {
            decryptionFailureReason: DecryptionFailureBodyViewModel.getDecryptionReasonFromCode(decryptionFailureCode),
            isLocalDeviceVerified: verificationState,
            extraClassNames: extraClassNames ? defaultClassNames.concat(extraClassNames) : defaultClassNames,
        };
    };

    public constructor(props: DecryptionFailureBodyViewModelProps) {
        super(
            props,
            DecryptionFailureBodyViewModel.computeSnapshot(
                props.decryptionFailureCode,
                props.verificationState,
                props.extraClassNames,
            ),
        );
    }

    /**
     * Updates the properties of the view model and recomputes the snapshot.
     * @param newProps
     */
    public setVerificationState(verificationState?: boolean): void {
        this.props.verificationState = verificationState;
        this.snapshot.set(
            DecryptionFailureBodyViewModel.computeSnapshot(
                this.props.decryptionFailureCode,
                this.props.verificationState,
                this.props.extraClassNames,
            ),
        );
    }
}
