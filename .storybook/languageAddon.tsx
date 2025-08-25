/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Addon, types, useGlobals } from "storybook/manager-api";
import { WithTooltip, IconButton, TooltipLinkList } from "storybook/internal/components";
import React from "react";
import { GlobeIcon } from "@storybook/icons";

// We can't import `shared/i18n.tsx` directly here.
// The storybook addon doesn't seem to benefit the vite config of storybook and we can't resolve the alias in i18n.tsx.
import json from "../webapp/i18n/languages.json";
const languages = Object.keys(json).filter((lang) => lang !== "default");

/**
 * Returns the title of a language in the user's locale.
 */
function languageTitle(language: string): string {
    return new Intl.DisplayNames([language], { type: "language", style: "short" }).of(language) || language;
}

export const languageAddon: Addon = {
    title: "Language Selector",
    type: types.TOOL,
    render: ({ active }) => {
        const [globals, updateGlobals] = useGlobals();
        const selectedLanguage = globals.language || "en";

        return (
            <WithTooltip
                placement="top"
                trigger="click"
                closeOnOutsideClick
                tooltip={({ onHide }) => {
                    return (
                        <TooltipLinkList
                            links={languages.map((language) => ({
                                id: language,
                                title: languageTitle(language),
                                active: selectedLanguage === language,
                                onClick: async () => {
                                    // Update the global state with the selected language
                                    updateGlobals({ language });
                                    onHide();
                                },
                            }))}
                        />
                    );
                }}
            >
                <IconButton title="Language">
                    <GlobeIcon />
                    {languageTitle(selectedLanguage)}
                </IconButton>
            </WithTooltip>
        );
    },
};
