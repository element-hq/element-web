/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mergeExpects, type Expect } from "@playwright/test";

import {
    expect as screenshotExpectations,
    Expectations as ScreenshotExpectations,
    ToMatchScreenshotOptions,
} from "./screenshot.js";
import { expect as axeExpectations, Expectations as AxeExpectations } from "./axe.js";

export const expect = mergeExpects(screenshotExpectations, axeExpectations) as Expect<
    ScreenshotExpectations & AxeExpectations
>;

export type { ToMatchScreenshotOptions };
