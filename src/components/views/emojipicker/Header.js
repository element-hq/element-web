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

class Header extends React.Component {
    static propTypes = {
        categories: PropTypes.arrayOf(PropTypes.object).isRequired,
        onAnchorClick: PropTypes.func.isRequired,
        defaultCategory: PropTypes.string,
    };

    constructor(props) {
        super(props);
        this.state = {
            selected: props.defaultCategory || props.categories[0].id,
        };
        this.handleClick = this.handleClick.bind(this);
    }

    handleClick(ev) {
        const selected = ev.target.getAttribute("data-category-id");
        this.setState({selected});
        this.props.onAnchorClick(selected);
    };

    render() {
        return (
            <nav className="mx_EmojiPicker_header">
                {this.props.categories.map(category => (
                    <button key={category.id} className={`mx_EmojiPicker_anchor ${
                        this.state.selected === category.id ? 'mx_EmojiPicker_anchor_selected' : ''}`}
                        onClick={this.handleClick} data-category-id={category.id} title={category.name}>
                        {icons.categories[category.id]()}
                    </button>
                ))}
            </nav>
        )
    }
}

export default Header;
