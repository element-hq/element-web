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

class Preview extends React.PureComponent {
    static propTypes = {
        emoji: PropTypes.object,
    };

    render() {
        const {
            unicode = "",
            annotation = "",
            shortcodes: [shortcode = ""],
        } = this.props.emoji || {};
        return (
            <div className="mx_EmojiPicker_footer mx_EmojiPicker_preview">
                <div className="mx_EmojiPicker_preview_emoji">
                    {unicode}
                </div>
                <div className="mx_EmojiPicker_preview_text">
                    <div className="mx_EmojiPicker_name mx_EmojiPicker_preview_name">
                        {annotation}
                    </div>
                    <div className="mx_EmojiPicker_shortcode">
                        {shortcode}
                    </div>
                </div>
            </div>
        );
    }
}

export default Preview;
