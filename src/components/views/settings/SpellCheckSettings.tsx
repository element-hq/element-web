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
import SpellCheckLanguagesDropdown from "../../../components/views/elements/SpellCheckLanguagesDropdown";
import AccessibleButton from "../../../components/views/elements/AccessibleButton";
import {_t} from "../../../languageHandler";
import {replaceableComponent} from "../../../utils/replaceableComponent";

interface ExistingSpellCheckLanguageIProps {
    language: string,
    onRemoved(language: string),
}

interface SpellCheckLanguagesIProps {
    languages: Array<string>,
    onLanguagesChange(languages: Array<string>),
}

interface SpellCheckLanguagesIState {
    newLanguage: string,
}

export class ExistingSpellCheckLanguage extends React.Component<ExistingSpellCheckLanguageIProps> {
    _onRemove = (e) => {
        e.stopPropagation();
        e.preventDefault();

        return this.props.onRemoved(this.props.language);
    };

    render() {
        return (
            <div className="mx_ExistingSpellCheckLanguage">
                <span className="mx_ExistingSpellCheckLanguage_language">{this.props.language}</span>
                <AccessibleButton onClick={this._onRemove} kind="danger_sm">
                    {_t("Remove")}
                </AccessibleButton>
            </div>
        );
    }
}

@replaceableComponent("views.settings.SpellCheckLanguages")
export default class SpellCheckLanguages extends React.Component<SpellCheckLanguagesIProps, SpellCheckLanguagesIState> {
    constructor(props) {
        super(props);
        this.state = {
            newLanguage: "",
        }
    }

    _onRemoved = (language) => {
        const languages = this.props.languages.filter((e) => e !== language);
        this.props.onLanguagesChange(languages);
    };

    _onAddClick = (e) => {
        e.stopPropagation();
        e.preventDefault();

        const language = this.state.newLanguage;

        if (!language) return;
        if (this.props.languages.includes(language)) return;

        this.props.languages.push(language)
        this.props.onLanguagesChange(this.props.languages);
    };

    _onNewLanguageChange = (language: string) => {
        if (this.state.newLanguage === language) return;
        this.setState({newLanguage: language});
    };

    render() {
        const existingSpellCheckLanguages = this.props.languages.map((e) => {
            return <ExistingSpellCheckLanguage language={e} onRemoved={this._onRemoved} key={e} />;
        });

        const addButton = (
            <AccessibleButton onClick={this._onAddClick} kind="primary">
                {_t("Add")}
            </AccessibleButton>
        );

        return (
            <div className="mx_SpellCheckLanguages">
                {existingSpellCheckLanguages}
                <form onSubmit={this._onAddClick} noValidate={true}>
                    <SpellCheckLanguagesDropdown
                        className="mx_GeneralUserSettingsTab_spellCheckLanguageInput"
                        value={this.state.newLanguage}
                        onOptionChange={this._onNewLanguageChange} />
                    {addButton}
                </form>
            </div>
        );
    }
}
