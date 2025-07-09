/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { addons } from "storybook/manager-api";
import ElementTheme from "./ElementTheme";

addons.setConfig({
    theme: ElementTheme,
});
