/*
Copyright 2024 New Vector Ltd.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import SpellCheckLanguagesDropdown from "../../../components/views/elements/SpellCheckLanguagesDropdown";
import AccessibleButton, { type ButtonEvent } from "../../../components/views/elements/AccessibleButton";
import { _t, getUserLanguage } from "../../../languageHandler";

interface ExistingSpellCheckLanguageIProps {
    language: string;
    /**
     * The label to render on the component. If not provided, the language code will be used.
     */
    label?: string;
    onRemoved(language: string): void;
}

interface SpellCheckLanguagesIProps {
    languages: Array<string>;
    onLanguagesChange(languages: Array<string>): void;
}

interface SpellCheckLanguagesIState {
    newLanguage: string;
}

export class ExistingSpellCheckLanguage extends React.Component<ExistingSpellCheckLanguageIProps> {
    private onRemove = (e: ButtonEvent): void => {
        e.stopPropagation();
        e.preventDefault();

        return this.props.onRemoved(this.props.language);
    };

    public render(): React.ReactNode {
        return (
            <div className="mx_ExistingSpellCheckLanguage">
                <span className="mx_ExistingSpellCheckLanguage_language">
                    {this.props.label ?? this.props.language}
                </span>
                <AccessibleButton onClick={this.onRemove} kind="danger_sm">
                    {_t("action|remove")}
                </AccessibleButton>
            </div>
        );
    }
}

export default class SpellCheckLanguages extends React.Component<SpellCheckLanguagesIProps, SpellCheckLanguagesIState> {
    public constructor(props: SpellCheckLanguagesIProps) {
        super(props);
        this.state = {
            newLanguage: "",
        };
    }

    private onRemoved = (language: string): void => {
        const languages = this.props.languages.filter((e) => e !== language);
        this.props.onLanguagesChange(languages);
    };

    private onAddClick = (e: ButtonEvent): void => {
        e.stopPropagation();
        e.preventDefault();

        const language = this.state.newLanguage;
        this.setState({ newLanguage: "" });

        if (!language) return;
        if (this.props.languages.includes(language)) return;

        this.props.languages.push(language);
        this.props.onLanguagesChange(this.props.languages);
    };

    private onNewLanguageChange = (language: string): void => {
        if (this.state.newLanguage === language) return;
        this.setState({ newLanguage: language });
    };

    public render(): React.ReactNode {
        const intl = new Intl.DisplayNames([getUserLanguage()], { type: "language", style: "short" });
        const existingSpellCheckLanguages = this.props.languages.map((e) => {
            return <ExistingSpellCheckLanguage language={e} label={intl.of(e)} onRemoved={this.onRemoved} key={e} />;
        });

        const addButton = (
            <AccessibleButton onClick={this.onAddClick} kind="primary">
                {_t("action|add")}
            </AccessibleButton>
        );

        return (
            <>
                {existingSpellCheckLanguages}
                <form onSubmit={this.onAddClick} noValidate={true}>
                    <SpellCheckLanguagesDropdown
                        className="mx_GeneralUserSettingsTab_spellCheckLanguageInput"
                        value={this.state.newLanguage}
                        onOptionChange={this.onNewLanguageChange}
                    />
                    {addButton}
                </form>
            </>
        );
    }
}
