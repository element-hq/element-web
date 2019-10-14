/*
Copyright 2019 Tulir Asokan

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

import * as icons from "./icons";

class Search extends React.PureComponent {
    static propTypes = {
        query: PropTypes.string.isRequired,
        onChange: PropTypes.func.isRequired,
    };

    render() {
        return (
            <div className="mx_EmojiPicker_search">
                <input type="text" placeholder="Search" value={this.props.query}
                    onChange={ev => this.props.onChange(ev.target.value)}/>
                <button onClick={() => this.props.onChange("")}>
                    {this.props.query ? icons.search.delete() : icons.search.search()}
                </button>
            </div>
        )
    }
}

export default Search;
