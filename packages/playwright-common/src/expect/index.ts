/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mergeExpects, type Expect } from "@playwright/test";

import {
    expect as screenshotExpectations,
    type Expectations as ScreenshotExpectations,
    type ToMatchScreenshotOptions,
} from "./screenshot.js";
import { expect as axeExpectations, type Expectations as AxeExpectations } from "./axe.js";

export const expect = mergeExpects(screenshotExpectations, axeExpectations) as Expect<
    ScreenshotExpectations & AxeExpectations
>;

export type { ToMatchScreenshotOptions };
