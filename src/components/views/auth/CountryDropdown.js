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

import React from 'react';
import PropTypes from 'prop-types';

import sdk from '../../../index';

import { COUNTRIES } from '../../../phonenumber';

const COUNTRIES_BY_ISO2 = {};
for (const c of COUNTRIES) {
    COUNTRIES_BY_ISO2[c.iso2] = c;
}

function countryMatchesSearchQuery(query, country) {
    // Remove '+' if present (when searching for a prefix)
    if (query[0] === '+') {
        query = query.slice(1);
    }

    if (country.name.toUpperCase().indexOf(query.toUpperCase()) == 0) return true;
    if (country.iso2 == query.toUpperCase()) return true;
    if (country.prefix.indexOf(query) !== -1) return true;
    return false;
}

export default class CountryDropdown extends React.Component {
    constructor(props) {
        super(props);
        this._onSearchChange = this._onSearchChange.bind(this);
        this._onOptionChange = this._onOptionChange.bind(this);
        this._getShortOption = this._getShortOption.bind(this);

        this.state = {
            searchQuery: '',
        };
    }

    componentWillMount() {
        if (!this.props.value) {
            // If no value is given, we start with the first
            // country selected, but our parent component
            // doesn't know this, therefore we do this.
            this.props.onOptionChange(COUNTRIES[0]);
        }
    }

    _onSearchChange(search) {
        this.setState({
            searchQuery: search,
        });
    }

    _onOptionChange(iso2) {
        this.props.onOptionChange(COUNTRIES_BY_ISO2[iso2]);
    }

    _flagImgForIso2(iso2) {
        return <img src={require(`../../../../res/img/flags/${iso2}.png`)} />;
    }

    _getShortOption(iso2) {
        if (!this.props.isSmall) {
            return undefined;
        }
        let countryPrefix;
        if (this.props.showPrefix) {
            countryPrefix = '+' + COUNTRIES_BY_ISO2[iso2].prefix;
        }
        return <span className="mx_CountryDropdown_shortOption">
            { this._flagImgForIso2(iso2) }
            { countryPrefix }
        </span>;
    }

    render() {
        const Dropdown = sdk.getComponent('elements.Dropdown');

        let displayedCountries;
        if (this.state.searchQuery) {
            displayedCountries = COUNTRIES.filter(
                countryMatchesSearchQuery.bind(this, this.state.searchQuery),
            );
            if (
                this.state.searchQuery.length == 2 &&
                COUNTRIES_BY_ISO2[this.state.searchQuery.toUpperCase()]
            ) {
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
            return <div className="mx_CountryDropdown_option" key={country.iso2}>
                { this._flagImgForIso2(country.iso2) }
                { country.name } (+{ country.prefix })
            </div>;
        });

        // default value here too, otherwise we need to handle null / undefined
        // values between mounting and the initial value propgating
        const value = this.props.value || COUNTRIES[0].iso2;

        return <Dropdown className={this.props.className + " mx_CountryDropdown"}
            onOptionChange={this._onOptionChange} onSearchChange={this._onSearchChange}
            menuWidth={298} getShortOption={this._getShortOption}
            value={value} searchEnabled={true} disabled={this.props.disabled}
        >
            { options }
        </Dropdown>;
    }
}

CountryDropdown.propTypes = {
    className: PropTypes.string,
    isSmall: PropTypes.bool,
    // if isSmall, show +44 in the selected value
    showPrefix: PropTypes.bool,
    onOptionChange: PropTypes.func.isRequired,
    value: PropTypes.string,
    disabled: PropTypes.bool,
};
