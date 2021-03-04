/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

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

import React from 'react';

import Dropdown from "../../views/elements/Dropdown"
import * as sdk from '../../../index';
import PlatformPeg from "../../../PlatformPeg";
import SettingsStore from "../../../settings/SettingsStore";
import { _t } from "../../../languageHandler";

function languageMatchesSearchQuery(query, language) {
    if (language.label.toUpperCase().includes(query.toUpperCase())) return true;
    if (language.value.toUpperCase() === query.toUpperCase()) return true;
    return false;
}

interface SpellCheckLanguagesDropdownIProps {
    className: string,
    value: string,
    onOptionChange(language: string),
}

interface SpellCheckLanguagesDropdownIState {
    searchQuery: string,
    languages: any,
}

export default class SpellCheckLanguagesDropdown extends React.Component<SpellCheckLanguagesDropdownIProps,
                                                                         SpellCheckLanguagesDropdownIState> {
    constructor(props) {
        super(props);
        this._onSearchChange = this._onSearchChange.bind(this);

        this.state = {
            searchQuery: '',
            languages: null,
        };
    }

    componentDidMount() {
        const plaf = PlatformPeg.get();
        if (plaf) {
            plaf.getAvailableSpellCheckLanguages().then((languages) => {
                languages.sort(function(a, b) {
                    if (a < b) return -1;
                    if (a > b) return 1;
                    return 0;
                });
                const langs = [];
                languages.forEach((language) => {
                    langs.push({
                        label: language,
                        value: language,
                    })
                })
                this.setState({languages: langs});
            }).catch((e) => {
                this.setState({languages: ['en']});
            });
        }
    }

    _onSearchChange(search) {
        this.setState({
            searchQuery: search,
        });
    }

    render() {
        if (this.state.languages === null) {
            const Spinner = sdk.getComponent('elements.Spinner');
            return <Spinner />;
        }

        let displayedLanguages;
        if (this.state.searchQuery) {
            displayedLanguages = this.state.languages.filter((lang) => {
                return languageMatchesSearchQuery(this.state.searchQuery, lang);
            });
        } else {
            displayedLanguages = this.state.languages;
        }

        const options = displayedLanguages.map((language) => {
            return <div key={language.value}>
                { language.label }
            </div>;
        });

        // default value here too, otherwise we need to handle null / undefined;
        // values between mounting and the initial value propgating
        let language = SettingsStore.getValue("language", null, /*excludeDefault:*/true);
        let value = null;
        if (language) {
            value = this.props.value || language;
        } else {
            language = navigator.language || navigator.userLanguage;
            value = this.props.value || language;
        }

        return <Dropdown
            id="mx_LanguageDropdown"
            className={this.props.className}
            onOptionChange={this.props.onOptionChange}
            onSearchChange={this._onSearchChange}
            searchEnabled={true}
            value={value}
            label={_t("Language Dropdown")}>
            { options }
        </Dropdown>;
    }
}
