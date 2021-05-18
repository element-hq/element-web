/*
Copyright 2019 Tulir Asokan <tulir@maunium.net>
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { _t } from '../../../languageHandler';
import {Key} from "../../../Keyboard";
import {replaceableComponent} from "../../../utils/replaceableComponent";

interface IProps {
    query: string;
    onChange(value: string): void;
    onEnter(): void;
}

@replaceableComponent("views.emojipicker.Search")
class Search extends React.PureComponent<IProps> {
    private inputRef = React.createRef<HTMLInputElement>();

    componentDidMount() {
        // For some reason, neither the autoFocus nor just calling focus() here worked, so here's a setTimeout
        setTimeout(() => this.inputRef.current.focus(), 0);
    }

    private onKeyDown = (ev: React.KeyboardEvent) => {
        if (ev.key === Key.ENTER) {
            this.props.onEnter();
            ev.stopPropagation();
            ev.preventDefault();
        }
    };

    render() {
        let rightButton;
        if (this.props.query) {
            rightButton = (
                <button
                    onClick={() => this.props.onChange("")}
                    className="mx_EmojiPicker_search_icon mx_EmojiPicker_search_clear"
                    title={_t("Cancel search")}
                />
            );
        } else {
            rightButton = <span className="mx_EmojiPicker_search_icon" />;
        }

        return (
            <div className="mx_EmojiPicker_search">
                <input
                    autoFocus
                    type="text"
                    placeholder="Search"
                    value={this.props.query}
                    onChange={ev => this.props.onChange(ev.target.value)}
                    onKeyDown={this.onKeyDown}
                    ref={this.inputRef}
                />
                {rightButton}
            </div>
        );
    }
}

export default Search;
