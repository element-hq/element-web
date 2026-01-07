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

const languages = JSON.parse(process.env.STORYBOOK_LANGUAGES);

/**
 * Returns the title of a language in the user's locale.
 */
function languageTitle(language: string): string {
    const normalisedLang = language.toLowerCase().replace("_", "-");
    return new Intl.DisplayNames([normalisedLang], { type: "language", style: "short" }).of(normalisedLang) || language;
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
