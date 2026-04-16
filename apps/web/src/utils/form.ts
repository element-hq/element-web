/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type React from "react";

/**
 * onSubmit handler which calls preventDefault and stopPropagation on the event
 * @param e submit event
 */
export function onSubmitPreventDefault(e: SubmitEvent | React.SubmitEvent): void {
    e.preventDefault();
    e.stopPropagation();
}
