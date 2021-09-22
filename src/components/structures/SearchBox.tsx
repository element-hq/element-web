/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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

import React, { createRef } from 'react';
import { Key } from '../../Keyboard';
import dis from '../../dispatcher/dispatcher';
import { throttle } from 'lodash';
import AccessibleButton from '../../components/views/elements/AccessibleButton';
import classNames from 'classnames';
import { replaceableComponent } from "../../utils/replaceableComponent";

interface IProps {
    onSearch?: (query: string) => void;
    onCleared?: (source?: string) => void;
    onKeyDown?: (ev: React.KeyboardEvent) => void;
    onFocus?: (ev: React.FocusEvent) => void;
    onBlur?: (ev: React.FocusEvent) => void;
    className?: string;
    placeholder: string;
    blurredPlaceholder?: string;
    autoFocus?: boolean;
    initialValue?: string;
    collapsed?: boolean;

    // If true, the search box will focus and clear itself
    // on room search focus action (it would be nicer to take
    // this functionality out, but not obvious how that would work)
    enableRoomSearchFocus?: boolean;
}

interface IState {
    searchTerm: string;
    blurred: boolean;
}

@replaceableComponent("structures.SearchBox")
export default class SearchBox extends React.Component<IProps, IState> {
    private dispatcherRef: string;
    private search = createRef<HTMLInputElement>();

    static defaultProps: Partial<IProps> = {
        enableRoomSearchFocus: false,
    };

    constructor(props: IProps) {
        super(props);

        this.state = {
            searchTerm: props.initialValue || "",
            blurred: true,
        };
    }

    public componentDidMount(): void {
        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentWillUnmount(): void {
        dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload): void => {
        if (!this.props.enableRoomSearchFocus) return;

        switch (payload.action) {
            case 'view_room':
                if (this.search.current && payload.clear_search) {
                    this.clearSearch();
                }
                break;
            case 'focus_room_filter':
                if (this.search.current) {
                    this.search.current.focus();
                }
                break;
        }
    };

    private onChange = (): void => {
        if (!this.search.current) return;
        this.setState({ searchTerm: this.search.current.value });
        this.onSearch();
    };

    private onSearch = throttle((): void => {
        this.props.onSearch(this.search.current.value);
    }, 200, { trailing: true, leading: true });

    private onKeyDown = (ev: React.KeyboardEvent): void => {
        switch (ev.key) {
            case Key.ESCAPE:
                this.clearSearch("keyboard");
                break;
        }
        if (this.props.onKeyDown) this.props.onKeyDown(ev);
    };

    private onFocus = (ev: React.FocusEvent): void => {
        this.setState({ blurred: false });
        (ev.target as HTMLInputElement).select();
        if (this.props.onFocus) {
            this.props.onFocus(ev);
        }
    };

    private onBlur = (ev: React.FocusEvent): void => {
        this.setState({ blurred: true });
        if (this.props.onBlur) {
            this.props.onBlur(ev);
        }
    };

    private clearSearch(source?: string): void {
        this.search.current.value = "";
        this.onChange();
        if (this.props.onCleared) {
            this.props.onCleared(source);
        }
    }

    public render(): JSX.Element {
        // check for collapsed here and
        // not at parent so we keep
        // searchTerm in our state
        // when collapsing and expanding
        if (this.props.collapsed) {
            return null;
        }
        const clearButton = (!this.state.blurred || this.state.searchTerm) ?
            (<AccessibleButton
                key="button"
                tabIndex={-1}
                className="mx_SearchBox_closeButton"
                onClick={() => {this.clearSearch("button"); }}
            />) : undefined;

        // show a shorter placeholder when blurred, if requested
        // this is used for the room filter field that has
        // the explore button next to it when blurred
        const placeholder = this.state.blurred ?
            (this.props.blurredPlaceholder || this.props.placeholder) :
            this.props.placeholder;
        const className = this.props.className || "";
        return (
            <div className={classNames("mx_SearchBox", "mx_textinput", { "mx_SearchBox_blurred": this.state.blurred })}>
                <input
                    key="searchfield"
                    type="text"
                    ref={this.search}
                    className={"mx_textinput_icon mx_textinput_search " + className}
                    value={this.state.searchTerm}
                    onFocus={this.onFocus}
                    onChange={this.onChange}
                    onKeyDown={this.onKeyDown}
                    onBlur={this.onBlur}
                    placeholder={placeholder}
                    autoComplete="off"
                    autoFocus={this.props.autoFocus}
                />
                { clearButton }
            </div>
        );
    }
}
