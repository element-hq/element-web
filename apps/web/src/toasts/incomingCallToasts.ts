/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IToast } from "../stores/ToastStore";

/**
 * Whether a toast is an incoming-call toast ({@link IncomingCallToast} or
 * {@link IncomingLegacyCallToast}), identified by its typed `callKind` marker.
 * Used to route these toasts to the prominent full-screen {@link IncomingCallPopup}
 * instead of the corner {@link ToastContainer}.
 */
export function isIncomingCallToast(toast: IToast<any>): boolean {
    return toast.callKind !== undefined;
}
