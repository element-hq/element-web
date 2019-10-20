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

class Header extends React.PureComponent {
    static propTypes = {
        categories: PropTypes.arrayOf(PropTypes.object).isRequired,
        onAnchorClick: PropTypes.func.isRequired,
        refs: PropTypes.object,
    };

    render() {
        return (
            <nav className="mx_EmojiPicker_header">
                {this.props.categories.map(category => (
                    <button disabled={!category.enabled} key={category.id} ref={category.ref}
                        className={`mx_EmojiPicker_anchor ${category.visible ? 'mx_EmojiPicker_anchor_visible' : ''}
                            mx_EmojiPicker_anchor_${category.id}`}
                        onClick={() => this.props.onAnchorClick(category.id)} title={category.name} />
                ))}
            </nav>
        );
    }
}

export default Header;
