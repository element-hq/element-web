/*
Copyright 2016 OpenMarket Ltd

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
import classnames from 'classnames';

export default class DirectorySearchBox extends React.Component {
    constructor() {
        super();
        this.collectInput = this.collectInput.bind(this);
        this.onClearClick = this.onClearClick.bind(this);
        this.onChange = this.onChange.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onJoinButtonClick = this.onJoinButtonClick.bind(this);

        this.input = null;
    }

    collectInput(e) {
        this.input = e;
    }

    onClearClick() {
        if (this.input) {
            this.input.value = '';
            this.input.focus();

            if (this.props.onClear) {
                this.props.onClear();
            }
        }
    }

    onChange() {
        if (!this.input) return;

        if (this.props.onChange) {
            this.props.onChange(this.input.value);
        }
    }

    onKeyUp(ev) {
        if (ev.key == 'Enter') {
            if (this.props.onJoinClick) {
                this.props.onJoinClick(this.input.value);
            }
        }
    }

    onJoinButtonClick() {
    }

    _contentLooksLikeAlias() {
        return true;
    }

    render() {
        const searchbox_classes = {
            mx_DirectorySearchBox: true,
        };
        searchbox_classes[this.props.className] = true;

        let join_button;
        if (this._contentLooksLikeAlias()) {
            join_button = <span className="mx_DirectorySearchBox_joinButton"
                onClick={this.onJoinButtonClick}
            >
                Join
            </span>;
        }

        return <span className={classnames(searchbox_classes)}>
            <input type="text" size="64"
                className="mx_DirectorySearchBox_input"
                ref={this.collectInput}
                onChange={this.onChange} onKeyUp={this.onKeyUp}
                placeholder="Find a room by keyword or room ID (#matrix:matrix.org)"
            />
            {join_button}
            <span className="mx_DirectorySearchBox_clear" onClick={this.onClearClick} />
        </span>;
    }
}

DirectorySearchBox.propTypes = {
    className: React.PropTypes.string,
    onChange: React.PropTypes.func,
    onClear: React.PropTypes.func,
    onJoinClick: React.PropTypes.func,
};
