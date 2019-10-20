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

import sdk from '../../../index';

class Category extends React.PureComponent {
    static propTypes = {
        emojis: PropTypes.arrayOf(PropTypes.object).isRequired,
        name: PropTypes.string.isRequired,
        id: PropTypes.string.isRequired,
        onMouseEnter: PropTypes.func.isRequired,
        onMouseLeave: PropTypes.func.isRequired,
        onClick: PropTypes.func.isRequired,
        selectedEmojis: PropTypes.instanceOf(Set),
    };

    render() {
        const { onClick, onMouseEnter, onMouseLeave, emojis, name, selectedEmojis } = this.props;
        if (!emojis || emojis.length === 0) {
            return null;
        }

        const Emoji = sdk.getComponent("emojipicker.Emoji");
        return (
            <section className="mx_EmojiPicker_category" data-category-id={this.props.id}>
                <h2 className="mx_EmojiPicker_category_label">
                    {name}
                </h2>
                <ul className="mx_EmojiPicker_list">
                    {emojis.map(emoji => <Emoji key={emoji.hexcode} emoji={emoji} selectedEmojis={selectedEmojis}
                        onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />)}
                </ul>
            </section>
        );
    }
}

export default Category;
