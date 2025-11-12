/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { addons } from "storybook/manager-api";
import ElementTheme from "./ElementTheme";
import { languageAddon } from "./languageAddon";

addons.setConfig({
    theme: ElementTheme,
});

addons.register("elementhq/language", () => addons.add("language", languageAddon));
