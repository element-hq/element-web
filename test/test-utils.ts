/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { RenderResult, screen, waitFor } from "@testing-library/react";

// wait for loading page
export async function waitForLoadingSpinner(): Promise<void> {
    await screen.findByRole("progressbar");
}

export async function waitForWelcomeComponent(matrixChat?: RenderResult): Promise<void> {
    await waitFor(() => matrixChat?.container.querySelector(".mx_Welcome"));
}
