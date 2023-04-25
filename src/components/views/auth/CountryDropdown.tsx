/*
Copyright 2017 Vector Creations Ltd

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

import { COUNTRIES, getEmojiFlag, PhoneNumberCountryDefinition } from "../../../phonenumber";
import SdkConfig from "../../../SdkConfig";
import { _t } from "../../../languageHandler";
import Dropdown from "../elements/Dropdown";
import { NonEmptyArray } from "../../../@types/common";

const COUNTRIES_BY_ISO2: Record<string, PhoneNumberCountryDefinition> = {};
for (const c of COUNTRIES) {
    COUNTRIES_BY_ISO2[c.iso2] = c;
}

function countryMatchesSearchQuery(query: string, country: PhoneNumberCountryDefinition): boolean {
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
    onOptionChange: (country: PhoneNumberCountryDefinition) => void;
    isSmall: boolean; // if isSmall, show +44 in the selected value
    showPrefix: boolean;
    className?: string;
    disabled?: boolean;
}

interface IState {
    searchQuery: string;
    defaultCountry: PhoneNumberCountryDefinition;
}

export default class CountryDropdown extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        let defaultCountry: PhoneNumberCountryDefinition | undefined;
        const defaultCountryCode = SdkConfig.get("default_country_code");
        if (defaultCountryCode) {
            const country = COUNTRIES.find((c) => c.iso2 === defaultCountryCode.toUpperCase());
            if (country) defaultCountry = country;
        }

        if (!defaultCountry) {
            try {
                const locale = new Intl.Locale(navigator.language ?? navigator.languages[0]);
                const code = locale.region ?? locale.language ?? locale.baseName;
                const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
                const displayName = displayNames.of(code)?.toUpperCase();
                defaultCountry = COUNTRIES.find(
                    (c) => c.iso2 === code.toUpperCase() || c.name.toUpperCase() === displayName,
                );
            } catch (e) {
                console.warn("Failed to detect default locale", e);
            }
        }

        this.state = {
            searchQuery: "",
            defaultCountry: defaultCountry ?? COUNTRIES[0],
        };
    }

    public componentDidMount(): void {
        if (!this.props.value) {
            // If no value is given, we start with the default
            // country selected, but our parent component
            // doesn't know this, therefore we do this.
            this.props.onOptionChange(this.state.defaultCountry);
        }
    }

    private onSearchChange = (search: string): void => {
        this.setState({
            searchQuery: search,
        });
    };

    private onOptionChange = (iso2: string): void => {
        this.props.onOptionChange(COUNTRIES_BY_ISO2[iso2]);
    };

    private flagImgForIso2(iso2: string): React.ReactNode {
        return <div className="mx_Dropdown_option_emoji">{getEmojiFlag(iso2)}</div>;
    }

    private getShortOption = (iso2: string): React.ReactNode => {
        if (!this.props.isSmall) {
            return undefined;
        }
        let countryPrefix;
        if (this.props.showPrefix) {
            countryPrefix = "+" + COUNTRIES_BY_ISO2[iso2].prefix;
        }
        return (
            <span className="mx_CountryDropdown_shortOption">
                {this.flagImgForIso2(iso2)}
                {countryPrefix}
            </span>
        );
    };

    public render(): React.ReactNode {
        let displayedCountries;
        if (this.state.searchQuery) {
            displayedCountries = COUNTRIES.filter(countryMatchesSearchQuery.bind(this, this.state.searchQuery));
            if (this.state.searchQuery.length == 2 && COUNTRIES_BY_ISO2[this.state.searchQuery.toUpperCase()]) {
                // exact ISO2 country name match: make the first result the matches ISO2
                const matched = COUNTRIES_BY_ISO2[this.state.searchQuery.toUpperCase()];
                displayedCountries = displayedCountries.filter((c) => {
                    return c.iso2 != matched.iso2;
                });
                displayedCountries.unshift(matched);
            }
        } else {
            displayedCountries = COUNTRIES;
        }

        const options = displayedCountries.map((country) => {
            return (
                <div className="mx_CountryDropdown_option" key={country.iso2}>
                    {this.flagImgForIso2(country.iso2)}
                    {_t(country.name)} (+{country.prefix})
                </div>
            );
        }) as NonEmptyArray<ReactElement & { key: string }>;

        // default value here too, otherwise we need to handle null / undefined
        // values between mounting and the initial value propagating
        const value = this.props.value || this.state.defaultCountry.iso2;

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
                label={_t("Country Dropdown")}
                autoComplete="tel-country-code"
            >
                {options}
            </Dropdown>
        );
    }
}
