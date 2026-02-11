/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type RenderResult, screen, waitFor } from "jest-matrix-react";

export * from "./beacon";
export * from "./client";
export * from "./location";
export * from "./platform";
export * from "./poll";
export * from "./room";
export * from "./test-utils";
export * from "./call";
export * from "./wrappers";
export * from "./utilities";
export * from "./date";
export * from "./relations";
export * from "./console";

// wait for loading page
export async function waitForLoadingSpinner(): Promise<void> {
    await screen.findByRole("progressbar");
}

export async function waitForWelcomeComponent(matrixChat?: RenderResult): Promise<void> {
    await waitFor(() => matrixChat?.container.querySelector(".mx_Welcome"));
}
