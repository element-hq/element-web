/*
Copyright 2024 New Vector Ltd.
Copyright 2017 Marcel Radzio (MTRNord)
Copyright 2017 Vector Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";
import classNames from "classnames";

import * as languageHandler from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import { _t } from "../../../languageHandler";
import Spinner from "./Spinner";
import Dropdown from "./Dropdown";
import { type NonEmptyArray } from "../../../@types/common";

type Languages = Awaited<ReturnType<typeof languageHandler.getAllLanguagesWithLabels>>;

function languageMatchesSearchQuery(query: string, language: Languages[0]): boolean {
    if (language.labelInTargetLanguage.toUpperCase().includes(query.toUpperCase())) return true;
    if (language.label.toUpperCase().includes(query.toUpperCase())) return true;
    if (language.value.toUpperCase() === query.toUpperCase()) return true;
    return false;
}

interface IProps {
    className?: string;
    onOptionChange: (language: string) => void;
    value?: string;
    disabled?: boolean;
}

interface IState {
    searchQuery: string;
    langs: Languages | null;
}

export default class LanguageDropdown extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            searchQuery: "",
            langs: null,
        };
    }

    public componentDidMount(): void {
        languageHandler
            .getAllLanguagesWithLabels()
            .then((langs) => {
                langs.sort(function (a, b) {
                    if (a.labelInTargetLanguage < b.labelInTargetLanguage) return -1;
                    if (a.labelInTargetLanguage > b.labelInTargetLanguage) return 1;
                    return 0;
                });
                this.setState({ langs });
            })
            .catch(() => {
                this.setState({
                    langs: [
                        {
                            value: "en",
                            label: "English",
                            labelInTargetLanguage: "English",
                        },
                    ],
                });
            });

        if (!this.props.value) {
            // If no value is given, we start with the first country selected,
            // but our parent component doesn't know this, therefore we do this.
            const language = languageHandler.getUserLanguage();
            this.props.onOptionChange(language);
        }
    }

    private onSearchChange = (search: string): void => {
        this.setState({
            searchQuery: search,
        });
    };

    public render(): React.ReactNode {
        if (this.state.langs === null) {
            return <Spinner />;
        }

        let displayedLanguages: Awaited<ReturnType<typeof languageHandler.getAllLanguagesWithLabels>>;
        if (this.state.searchQuery) {
            displayedLanguages = this.state.langs.filter((lang) => {
                return languageMatchesSearchQuery(this.state.searchQuery, lang);
            });
        } else {
            displayedLanguages = this.state.langs;
        }

        const options = displayedLanguages.map((language) => {
            return <div key={language.value}>{language.labelInTargetLanguage}</div>;
        }) as NonEmptyArray<ReactElement & { key: string }>;

        // default value here too, otherwise we need to handle null / undefined
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
                className={classNames("mx_LanguageDropdown", this.props.className)}
                onOptionChange={this.props.onOptionChange}
                onSearchChange={this.onSearchChange}
                searchEnabled={true}
                value={value}
                label={_t("language_dropdown_label")}
                disabled={this.props.disabled}
            >
                {options}
            </Dropdown>
        );
    }
}
