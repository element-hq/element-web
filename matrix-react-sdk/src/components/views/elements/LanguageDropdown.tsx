/*
Copyright 2017 Marcel Radzio (MTRNord)
Copyright 2017 Vector Creations Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { ReactElement } from "react";

import * as languageHandler from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import { _t } from "../../../languageHandler";
import Spinner from "./Spinner";
import Dropdown from "./Dropdown";
import { NonEmptyArray } from "../../../@types/common";

type Languages = Awaited<ReturnType<typeof languageHandler.getAllLanguagesFromJson>>;

function languageMatchesSearchQuery(query: string, language: Languages[0]): boolean {
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
            .getAllLanguagesFromJson()
            .then((langs) => {
                langs.sort(function (a, b) {
                    if (a.label < b.label) return -1;
                    if (a.label > b.label) return 1;
                    return 0;
                });
                this.setState({ langs });
            })
            .catch(() => {
                this.setState({ langs: [{ value: "en", label: "English" }] });
            });

        if (!this.props.value) {
            // If no value is given, we start with the first
            // country selected, but our parent component
            // doesn't know this, therefore we do this.
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

        let displayedLanguages: Awaited<ReturnType<typeof languageHandler.getAllLanguagesFromJson>>;
        if (this.state.searchQuery) {
            displayedLanguages = this.state.langs.filter((lang) => {
                return languageMatchesSearchQuery(this.state.searchQuery, lang);
            });
        } else {
            displayedLanguages = this.state.langs;
        }

        const options = displayedLanguages.map((language) => {
            return <div key={language.value}>{language.label}</div>;
        }) as NonEmptyArray<ReactElement & { key: string }>;

        // default value here too, otherwise we need to handle null / undefined
        // values between mounting and the initial value propagating
        let language = SettingsStore.getValue<string | undefined>("language", null, /*excludeDefault:*/ true);
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
                label={_t("Language Dropdown")}
                disabled={this.props.disabled}
            >
                {options}
            </Dropdown>
        );
    }
}
