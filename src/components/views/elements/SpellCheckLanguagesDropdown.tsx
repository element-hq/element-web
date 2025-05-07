/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";

import Dropdown from "../../views/elements/Dropdown";
import PlatformPeg from "../../../PlatformPeg";
import SettingsStore from "../../../settings/SettingsStore";
import { _t, getUserLanguage } from "../../../languageHandler";
import Spinner from "./Spinner";
import { type NonEmptyArray } from "../../../@types/common";

type Languages = {
    value: string;
    label: string; // translated
}[];
function languageMatchesSearchQuery(query: string, language: Languages[0]): boolean {
    if (language.label.toUpperCase().includes(query.toUpperCase())) return true;
    if (language.value.toUpperCase() === query.toUpperCase()) return true;
    return false;
}

interface SpellCheckLanguagesDropdownIProps {
    className: string;
    value: string;
    onOptionChange(language: string): void;
}

interface SpellCheckLanguagesDropdownIState {
    searchQuery: string;
    languages?: Languages;
}

export default class SpellCheckLanguagesDropdown extends React.Component<
    SpellCheckLanguagesDropdownIProps,
    SpellCheckLanguagesDropdownIState
> {
    public constructor(props: SpellCheckLanguagesDropdownIProps) {
        super(props);
        this.onSearchChange = this.onSearchChange.bind(this);

        this.state = {
            searchQuery: "",
        };
    }

    public componentDidMount(): void {
        const plaf = PlatformPeg.get();
        if (plaf) {
            const languageNames = new Intl.DisplayNames([getUserLanguage()], { type: "language", style: "short" });
            plaf
                .getAvailableSpellCheckLanguages()
                ?.then((languages) => {
                    languages.sort(function (a, b) {
                        if (a < b) return -1;
                        if (a > b) return 1;
                        return 0;
                    });
                    const langs: Languages = [];
                    languages.forEach((language) => {
                        langs.push({
                            label: languageNames.of(language)!,
                            value: language,
                        });
                    });
                    this.setState({ languages: langs });
                })
                .catch((e) => {
                    this.setState({
                        languages: [
                            {
                                value: "en",
                                label: languageNames.of("en")!,
                            },
                        ],
                    });
                });
        }
    }

    private onSearchChange(searchQuery: string): void {
        this.setState({ searchQuery });
    }

    public render(): React.ReactNode {
        if (!this.state.languages) {
            return <Spinner />;
        }

        let displayedLanguages: Languages;
        if (this.state.searchQuery) {
            displayedLanguages = this.state.languages.filter((lang) => {
                return languageMatchesSearchQuery(this.state.searchQuery, lang);
            });
        } else {
            displayedLanguages = this.state.languages;
        }

        const options = displayedLanguages.map((language) => {
            return <div key={language.value}>{language.label}</div>;
        }) as NonEmptyArray<ReactElement & { key: string }>;

        // default value here too, otherwise we need to handle null / undefined;
        // values between mounting and the initial value propagating
        let language = SettingsStore.getValue("language", null, /*excludeDefault:*/ true);
        let value: string | undefined;
        if (language) {
            value = this.props.value || language;
        } else {
            language = navigator.language || navigator.userLanguage;
            value = this.props.value || language;
        }

        return (
            <Dropdown
                id="mx_LanguageDropdown"
                className={this.props.className}
                onOptionChange={this.props.onOptionChange}
                onSearchChange={this.onSearchChange}
                searchEnabled={true}
                value={value}
                label={_t("language_dropdown_label")}
                placeholder={_t("settings|general|spell_check_locale_placeholder")}
            >
                {options}
            </Dropdown>
        );
    }
}
