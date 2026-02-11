/*
Copyright 2024 New Vector Ltd.
Copyright 2017 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";

import { COUNTRIES, getEmojiFlag, type PhoneNumberCountryDefinition } from "../../../phonenumber";
import SdkConfig from "../../../SdkConfig";
import { _t, getUserLanguage } from "../../../languageHandler";
import Dropdown from "../elements/Dropdown";
import { type NonEmptyArray } from "../../../@types/common";

interface InternationalisedCountry extends PhoneNumberCountryDefinition {
    name: string; // already translated to the user's locale
}

function countryMatchesSearchQuery(query: string, country: InternationalisedCountry): boolean {
    // Remove '+' if present (when searching for a prefix)
    if (query[0] === "+") {
        query = query.slice(1);
    }

    if (country.name.toUpperCase().indexOf(query.toUpperCase()) == 0) return true;
    if (country.iso2 == query.toUpperCase()) return true;
    if (country.prefix.indexOf(query) !== -1) return true;
    return false;
}

interface IProps {
    value?: string;
    onOptionChange: (country: InternationalisedCountry) => void;
    isSmall: boolean; // if isSmall, show +44 in the selected value
    showPrefix: boolean;
    className?: string;
    disabled?: boolean;
}

interface IState {
    searchQuery: string;
}

export default class CountryDropdown extends React.Component<IProps, IState> {
    private readonly defaultCountry: InternationalisedCountry;
    private readonly countries: InternationalisedCountry[];
    private readonly countryMap: Map<string, InternationalisedCountry>;

    public constructor(props: IProps) {
        super(props);

        const displayNames = new Intl.DisplayNames([getUserLanguage()], { type: "region" });

        this.countries = COUNTRIES.map((c) => ({
            name: displayNames.of(c.iso2) ?? c.iso2,
            ...c,
        }));
        this.countryMap = new Map(this.countries.map((c) => [c.iso2, c]));

        let defaultCountry: InternationalisedCountry | undefined;
        const defaultCountryCode = SdkConfig.get("default_country_code");
        if (defaultCountryCode) {
            const country = this.countries.find((c) => c.iso2 === defaultCountryCode.toUpperCase());
            if (country) defaultCountry = country;
        }

        if (!defaultCountry) {
            try {
                const locale = new Intl.Locale(navigator.language ?? navigator.languages[0]);
                const code = locale.region ?? locale.language ?? locale.baseName;
                const displayName = displayNames.of(code)!.toUpperCase();
                defaultCountry = this.countries.find(
                    (c) => c.iso2 === code.toUpperCase() || c.name.toUpperCase() === displayName,
                );
            } catch (e) {
                console.warn("Failed to detect default locale", e);
            }
        }

        this.defaultCountry = defaultCountry ?? this.countries[0];
        this.state = {
            searchQuery: "",
        };
    }

    public componentDidMount(): void {
        if (!this.props.value) {
            // If no value is given, we start with the default
            // country selected, but our parent component
            // doesn't know this, therefore we do this.
            this.props.onOptionChange(this.defaultCountry);
        }
    }

    private onSearchChange = (search: string): void => {
        this.setState({
            searchQuery: search,
        });
    };

    private onOptionChange = (iso2: string): void => {
        this.props.onOptionChange(this.countryMap.get(iso2)!);
    };

    private flagImgForIso2(iso2: string): React.ReactNode {
        return <div className="mx_Dropdown_option_emoji">{getEmojiFlag(iso2)}</div>;
    }

    private getShortOption = (iso2: string): React.ReactNode => {
        if (!this.props.isSmall) {
            return undefined;
        }
        let countryPrefix: string | undefined;
        if (this.props.showPrefix) {
            countryPrefix = "+" + this.countryMap.get(iso2)!.prefix;
        }
        return (
            <span className="mx_CountryDropdown_shortOption">
                {this.flagImgForIso2(iso2)}
                {countryPrefix}
            </span>
        );
    };

    public render(): React.ReactNode {
        let displayedCountries: InternationalisedCountry[];
        if (this.state.searchQuery) {
            displayedCountries = this.countries.filter((country) =>
                countryMatchesSearchQuery(this.state.searchQuery, country),
            );
            if (this.state.searchQuery.length == 2 && this.countryMap.has(this.state.searchQuery.toUpperCase())) {
                // exact ISO2 country name match: make the first result the matches ISO2
                const matched = this.countryMap.get(this.state.searchQuery.toUpperCase())!;
                displayedCountries = displayedCountries.filter((c) => {
                    return c.iso2 != matched.iso2;
                });
                displayedCountries.unshift(matched);
            }
        } else {
            displayedCountries = this.countries;
        }

        const options = displayedCountries.map((country) => {
            return (
                <div className="mx_CountryDropdown_option" key={country.iso2}>
                    {this.flagImgForIso2(country.iso2)}
                    {country.name} (+{country.prefix})
                </div>
            );
        }) as NonEmptyArray<ReactElement & { key: string }>;

        // default value here too, otherwise we need to handle null / undefined
        // values between mounting and the initial value propagating
        const value = this.props.value || this.defaultCountry.iso2;

        return (
            <Dropdown
                id="mx_CountryDropdown"
                className={this.props.className + " mx_CountryDropdown"}
                onOptionChange={this.onOptionChange}
                onSearchChange={this.onSearchChange}
                menuWidth={298}
                getShortOption={this.getShortOption}
                value={value}
                searchEnabled={true}
                disabled={this.props.disabled}
                label={_t("auth|country_dropdown")}
                autoComplete="tel-country-code"
            >
                {options}
            </Dropdown>
        );
    }
}
