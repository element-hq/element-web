/*
Copyright 2019 Tulir Asokan <tulir@maunium.net>

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
import { _t } from '../../../languageHandler';

class Search extends React.PureComponent {
    static propTypes = {
        query: PropTypes.string.isRequired,
        onChange: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);
        this.inputRef = React.createRef();
    }

    componentDidMount() {
        // For some reason, neither the autoFocus nor just calling focus() here worked, so here's a setTimeout
        setTimeout(() => this.inputRef.current.focus(), 0);
    }

    render() {
        let rightButton;
        if (this.props.query) {
            rightButton = (
                <button onClick={() => this.props.onChange("")}
                        className="mx_EmojiPicker_search_icon mx_EmojiPicker_search_clear"
                        title={_t("Cancel search")} />
            );
        } else {
            rightButton = <span className="mx_EmojiPicker_search_icon" />;
        }

        return (
            <div className="mx_EmojiPicker_search">
                <input autoFocus type="text" placeholder="Search" value={this.props.query}
                    onChange={ev => this.props.onChange(ev.target.value)} ref={this.inputRef} />
                {rightButton}
            </div>
        );
    }
}

export default Search;
