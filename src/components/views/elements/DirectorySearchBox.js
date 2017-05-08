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
        this._collectInput = this._collectInput.bind(this);
        this._onClearClick = this._onClearClick.bind(this);
        this._onChange = this._onChange.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        this._onJoinButtonClick = this._onJoinButtonClick.bind(this);

        this.input = null;

        this.state = {
            value: '',
        };
    }

    _collectInput(e) {
        this.input = e;
    }

    _onClearClick() {
        this.setState({value: ''});

        if (this.input) {
            this.input.focus();

            if (this.props.onClear) {
                this.props.onClear();
            }
        }
    }

    _onChange(ev) {
        if (!this.input) return;
        this.setState({value: ev.target.value});

        if (this.props.onChange) {
            this.props.onChange(ev.target.value);
        }
    }

    _onKeyUp(ev) {
        if (ev.key == 'Enter' && this.props.showJoinButton) {
            if (this.props.onJoinClick) {
                this.props.onJoinClick(this.state.value);
            }
        }
    }

    _onJoinButtonClick() {
        if (this.props.onJoinClick) {
            this.props.onJoinClick(this.state.value);
        }
    }

    render() {
        const searchbox_classes = {
            mx_DirectorySearchBox: true,
        };
        searchbox_classes[this.props.className] = true;

        let join_button;
        if (this.props.showJoinButton) {
            join_button = <span className="mx_DirectorySearchBox_joinButton"
                onClick={this._onJoinButtonClick}
            >
                Join
            </span>;
        }

        return <span className={classnames(searchbox_classes)}>
            <div className="mx_DirectorySearchBox_container">
                <input type="text" name="dirsearch" value={this.state.value}
                    className="mx_DirectorySearchBox_input"
                    ref={this._collectInput}
                    onChange={this._onChange} onKeyUp={this._onKeyUp}
                    placeholder={this.props.placeholder}
                />
                {join_button}
                <span className="mx_DirectorySearchBox_clear_wrapper">
                    <span className="mx_DirectorySearchBox_clear" onClick={this._onClearClick} />
                </span>
            </div>
        </span>;
    }
}

DirectorySearchBox.propTypes = {
    className: React.PropTypes.string,
    onChange: React.PropTypes.func,
    onClear: React.PropTypes.func,
    onJoinClick: React.PropTypes.func,
    placeholder: React.PropTypes.string,
    showJoinButton: React.PropTypes.bool,
};
