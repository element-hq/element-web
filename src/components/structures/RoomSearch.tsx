/*
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

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
import AccessibleButton from "../views/elements/AccessibleButton";
import { Action } from "../../dispatcher/actions";
import RoomListStore from "../../stores/room-list/RoomListStore";
import { NameFilterCondition } from "../../stores/room-list/filters/NameFilterCondition";
import { getKeyBindingsManager, RoomListAction } from "../../KeyBindingsManager";
import {replaceableComponent} from "../../utils/replaceableComponent";
import SpaceStore, {UPDATE_SELECTED_SPACE} from "../../stores/SpaceStore";

interface IProps {
    isMinimized: boolean;
    onKeyDown(ev: React.KeyboardEvent): void;
    /**
     * @returns true if a room has been selected and the search field should be cleared
     */
    onSelectRoom(): boolean;
}

interface IState {
    query: string;
    focused: boolean;
}

@replaceableComponent("structures.RoomSearch")
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
        // clear filter when changing spaces, in future we may wish to maintain a filter per-space
        SpaceStore.instance.on(UPDATE_SELECTED_SPACE, this.clearInput);
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
        SpaceStore.instance.off(UPDATE_SELECTED_SPACE, this.clearInput);
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
        const action = getKeyBindingsManager().getRoomListAction(ev);
        switch (action) {
            case RoomListAction.ClearSearch:
                this.clearInput();
                defaultDispatcher.fire(Action.FocusComposer);
                break;
            case RoomListAction.NextRoom:
            case RoomListAction.PrevRoom:
                // we don't handle these actions here put pass the event on to the interested party (LeftPanel)
                this.props.onKeyDown(ev);
                break;
            case RoomListAction.SelectRoom: {
                const shouldClear = this.props.onSelectRoom();
                if (shouldClear) {
                    // wrap in set immediate to delay it so that we don't clear the filter & then change room
                    setImmediate(() => {
                        this.clearInput();
                    });
                }
                break;
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
            <div className='mx_RoomSearch_icon' />
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
                placeholder={_t("Filter")}
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
                    title={_t("Filter rooms and people")}
                    className="mx_RoomSearch_icon mx_RoomSearch_minimizedHandle"
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
