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

import React from 'react';
import PropTypes from 'prop-types';

import * as sdk from '../../../index';
import * as languageHandler from '../../../languageHandler';
import SettingsStore from "../../../settings/SettingsStore";
import { _t } from "../../../languageHandler";

function languageMatchesSearchQuery(query, language) {
    if (language.label.toUpperCase().includes(query.toUpperCase())) return true;
    if (language.value.toUpperCase() === query.toUpperCase()) return true;
    return false;
}

export default class LanguageDropdown extends React.Component {
    constructor(props) {
        super(props);
        this._onSearchChange = this._onSearchChange.bind(this);

        this.state = {
            searchQuery: '',
            langs: null,
        };
    }

    componentDidMount() {
        languageHandler.getAllLanguagesFromJson().then((langs) => {
            langs.sort(function(a, b) {
                if (a.label < b.label) return -1;
                if (a.label > b.label) return 1;
                return 0;
            });
            this.setState({langs});
        }).catch(() => {
            this.setState({langs: ['en']});
        });

        if (!this.props.value) {
            // If no value is given, we start with the first
            // country selected, but our parent component
            // doesn't know this, therefore we do this.
            const language = SettingsStore.getValue("language", null, /*excludeDefault:*/true);
            if (language) {
              this.props.onOptionChange(language);
            } else {
              const language = languageHandler.normalizeLanguageKey(languageHandler.getLanguageFromBrowser());
              this.props.onOptionChange(language);
            }
        }
    }

    _onSearchChange(search) {
        this.setState({
            searchQuery: search,
        });
    }

    render() {
        if (this.state.langs === null) {
            const Spinner = sdk.getComponent('elements.Spinner');
            return <Spinner />;
        }

        const Dropdown = sdk.getComponent('elements.Dropdown');

        let displayedLanguages;
        if (this.state.searchQuery) {
            displayedLanguages = this.state.langs.filter((lang) => {
                return languageMatchesSearchQuery(this.state.searchQuery, lang);
            });
        } else {
            displayedLanguages = this.state.langs;
        }

        const options = displayedLanguages.map((language) => {
            return <div key={language.value}>
                { language.label }
            </div>;
        });

        // default value here too, otherwise we need to handle null / undefined
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
            label={_t("Language Dropdown")}
            disabled={this.props.disabled}
        >
            { options }
        </Dropdown>;
    }
}

LanguageDropdown.propTypes = {
    className: PropTypes.string,
    onOptionChange: PropTypes.func.isRequired,
    value: PropTypes.string,
};
