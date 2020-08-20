/*
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

import * as React from "react";
import { createRef } from "react";
import classNames from "classnames";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { _t } from "../../languageHandler";
import { ActionPayload } from "../../dispatcher/payloads";
import { throttle } from 'lodash';
import { Key } from "../../Keyboard";
import AccessibleButton from "../views/elements/AccessibleButton";
import { Action } from "../../dispatcher/actions";
import RoomListStore from "../../stores/room-list/RoomListStore";
import { NameFilterCondition } from "../../stores/room-list/filters/NameFilterCondition";

interface IProps {
    isMinimized: boolean;
    onVerticalArrow(ev: React.KeyboardEvent): void;
    onEnter(ev: React.KeyboardEvent): boolean;
}

interface IState {
    query: string;
    focused: boolean;
}

export default class RoomSearch extends React.PureComponent<IProps, IState> {
    private dispatcherRef: string;
    private inputRef: React.RefObject<HTMLInputElement> = createRef();
    private searchFilter: NameFilterCondition = new NameFilterCondition();

    constructor(props: IProps) {
        super(props);

        this.state = {
            query: "",
            focused: false,
        };

        this.dispatcherRef = defaultDispatcher.register(this.onAction);
    }

    public componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>): void {
        if (prevState.query !== this.state.query) {
            const hadSearch = !!this.searchFilter.search.trim();
            const haveSearch = !!this.state.query.trim();
            this.searchFilter.search = this.state.query;
            if (!hadSearch && haveSearch) {
                // started a new filter - add the condition
                RoomListStore.instance.addFilter(this.searchFilter);
            } else if (hadSearch && !haveSearch) {
                // cleared a filter - remove the condition
                RoomListStore.instance.removeFilter(this.searchFilter);
            } // else the filter hasn't changed enough for us to care here
        }
    }

    public componentWillUnmount() {
        defaultDispatcher.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload) => {
        if (payload.action === 'view_room' && payload.clear_search) {
            this.clearInput();
        } else if (payload.action === 'focus_room_filter' && this.inputRef.current) {
            this.inputRef.current.focus();
        }
    };

    private clearInput = () => {
        if (!this.inputRef.current) return;
        this.inputRef.current.value = "";
        this.onChange();
    };

    private openSearch = () => {
        defaultDispatcher.dispatch({action: "show_left_panel"});
        defaultDispatcher.dispatch({action: "focus_room_filter"});
    };

    private onChange = () => {
        if (!this.inputRef.current) return;
        this.setState({query: this.inputRef.current.value});
    };

    private onFocus = (ev: React.FocusEvent<HTMLInputElement>) => {
        this.setState({focused: true});
        ev.target.select();
    };

    private onBlur = (ev: React.FocusEvent<HTMLInputElement>) => {
        this.setState({focused: false});
    };

    private onKeyDown = (ev: React.KeyboardEvent) => {
        if (ev.key === Key.ESCAPE) {
            this.clearInput();
            defaultDispatcher.fire(Action.FocusComposer);
        } else if (ev.key === Key.ARROW_UP || ev.key === Key.ARROW_DOWN) {
            this.props.onVerticalArrow(ev);
        } else if (ev.key === Key.ENTER) {
            const shouldClear = this.props.onEnter(ev);
            if (shouldClear) {
                // wrap in set immediate to delay it so that we don't clear the filter & then change room
                setImmediate(() => {
                    this.clearInput();
                });
            }
        }
    };

    public render(): React.ReactNode {
        const classes = classNames({
            'mx_RoomSearch': true,
            'mx_RoomSearch_hasQuery': this.state.query,
            'mx_RoomSearch_focused': this.state.focused,
            'mx_RoomSearch_minimized': this.props.isMinimized,
        });

        const inputClasses = classNames({
            'mx_RoomSearch_input': true,
            'mx_RoomSearch_inputExpanded': this.state.query || this.state.focused,
        });

        let icon = (
            <div className='mx_RoomSearch_icon'/>
        );
        let input = (
            <input
                type="text"
                ref={this.inputRef}
                className={inputClasses}
                value={this.state.query}
                onFocus={this.onFocus}
                onBlur={this.onBlur}
                onChange={this.onChange}
                onKeyDown={this.onKeyDown}
                placeholder={_t("Search")}
                autoComplete="off"
            />
        );
        let clearButton = (
            <AccessibleButton
                tabIndex={-1}
                title={_t("Clear filter")}
                className="mx_RoomSearch_clearButton"
                onClick={this.clearInput}
            />
        );

        if (this.props.isMinimized) {
            icon = (
                <AccessibleButton
                    title={_t("Search rooms")}
                    className="mx_RoomSearch_icon"
                    onClick={this.openSearch}
                />
            );
            input = null;
            clearButton = null;
        }

        return (
            <div className={classes}>
                {icon}
                {input}
                {clearButton}
            </div>
        );
    }
}
