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
import { createRef, RefObject } from "react";
import classNames from "classnames";

import defaultDispatcher from "../../dispatcher/dispatcher";
import { _t } from "../../languageHandler";
import { ActionPayload } from "../../dispatcher/payloads";
import AccessibleButton from "../views/elements/AccessibleButton";
import { Action } from "../../dispatcher/actions";
import RoomListStore from "../../stores/room-list/RoomListStore";
import { NameFilterCondition } from "../../stores/room-list/filters/NameFilterCondition";
import { getKeyBindingsManager } from "../../KeyBindingsManager";
import { replaceableComponent } from "../../utils/replaceableComponent";
import SpaceStore from "../../stores/spaces/SpaceStore";
import { UPDATE_SELECTED_SPACE } from "../../stores/spaces";
import { isMac, Key } from "../../Keyboard";
import SettingsStore from "../../settings/SettingsStore";
import Modal from "../../Modal";
import SpotlightDialog from "../views/dialogs/SpotlightDialog";
import { ALTERNATE_KEY_NAME, KeyBindingAction } from "../../accessibility/KeyboardShortcuts";
import ToastStore from "../../stores/ToastStore";

interface IProps {
    isMinimized: boolean;
    /**
     * @returns true if a room has been selected and the search field should be cleared
     */
    onSelectRoom(): boolean;
}

interface IState {
    query: string;
    focused: boolean;
    spotlightBetaEnabled: boolean;
}

@replaceableComponent("structures.RoomSearch")
export default class RoomSearch extends React.PureComponent<IProps, IState> {
    private readonly dispatcherRef: string;
    private readonly betaRef: string;
    private elementRef: React.RefObject<HTMLInputElement | HTMLDivElement> = createRef();
    private searchFilter: NameFilterCondition = new NameFilterCondition();

    constructor(props: IProps) {
        super(props);

        this.state = {
            query: "",
            focused: false,
            spotlightBetaEnabled: SettingsStore.getValue("feature_spotlight"),
        };

        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        // clear filter when changing spaces, in future we may wish to maintain a filter per-space
        SpaceStore.instance.on(UPDATE_SELECTED_SPACE, this.clearInput);
        this.betaRef = SettingsStore.watchSetting("feature_spotlight", null, this.onSpotlightChange);
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
        SettingsStore.unwatchSetting(this.betaRef);
    }

    private onSpotlightChange = () => {
        const spotlightBetaEnabled = SettingsStore.getValue("feature_spotlight");
        if (this.state.spotlightBetaEnabled !== spotlightBetaEnabled) {
            this.setState({
                spotlightBetaEnabled,
                query: "",
            });
        }
        // in case the user was in settings at the 5-minute mark, dismiss the toast
        ToastStore.sharedInstance().dismissToast("BETA_SPOTLIGHT_TOAST");
    };

    private openSpotlight() {
        Modal.createTrackedDialog("Spotlight", "", SpotlightDialog, {}, "mx_SpotlightDialog_wrapper", false, true);
    }

    private onAction = (payload: ActionPayload) => {
        if (payload.action === Action.ViewRoom && payload.clear_search) {
            this.clearInput();
        } else if (payload.action === 'focus_room_filter') {
            if (this.state.spotlightBetaEnabled) {
                this.openSpotlight();
            } else {
                this.focus();
            }
        }
    };

    private clearInput = () => {
        if (this.elementRef.current?.tagName !== "INPUT") return;
        (this.elementRef.current as HTMLInputElement).value = "";
        this.onChange();
    };

    private openSearch = () => {
        if (this.state.spotlightBetaEnabled) {
            this.openSpotlight();
        } else {
            // dispatched as it needs handling by MatrixChat too
            defaultDispatcher.dispatch({ action: "focus_room_filter" });
        }
    };

    private onChange = () => {
        if (this.elementRef.current?.tagName !== "INPUT") return;
        this.setState({ query: (this.elementRef.current as HTMLInputElement).value });
    };

    private onFocus = (ev: React.FocusEvent<HTMLInputElement>) => {
        this.setState({ focused: true });
        ev.target.select();
    };

    private onBlur = (ev: React.FocusEvent<HTMLInputElement>) => {
        this.setState({ focused: false });
    };

    private onKeyDown = (ev: React.KeyboardEvent) => {
        const action = getKeyBindingsManager().getRoomListAction(ev);
        switch (action) {
            case KeyBindingAction.ClearRoomFilter:
                this.clearInput();
                defaultDispatcher.fire(Action.FocusSendMessageComposer);
                break;
            case KeyBindingAction.SelectRoomInRoomList: {
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

    public focus = (): void => {
        this.elementRef.current?.focus();
    };

    public render(): React.ReactNode {
        const classes = classNames({
            'mx_RoomSearch': true,
            'mx_RoomSearch_hasQuery': this.state.query,
            'mx_RoomSearch_focused': this.state.focused,
            'mx_RoomSearch_minimized': this.props.isMinimized,
            'mx_RoomSearch_spotlightTrigger': this.state.spotlightBetaEnabled,
        });

        const inputClasses = classNames({
            'mx_RoomSearch_input': true,
            'mx_RoomSearch_inputExpanded': this.state.query || this.state.focused,
        });

        const icon = (
            <div className="mx_RoomSearch_icon" />
        );

        let input = (
            <input
                type="text"
                ref={this.elementRef as RefObject<HTMLInputElement>}
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

        let shortcutPrompt = <div className="mx_RoomSearch_shortcutPrompt">
            { isMac ? "⌘ K" : _t(ALTERNATE_KEY_NAME[Key.CONTROL]) + " K" }
        </div>;

        if (this.props.isMinimized) {
            input = null;
            shortcutPrompt = null;
        }

        if (this.state.spotlightBetaEnabled) {
            return <AccessibleButton onClick={this.openSpotlight} className={classes} inputRef={this.elementRef}>
                { icon }
                { input && <div className="mx_RoomSearch_spotlightTriggerText">
                    { _t("Search") }
                </div> }
                { shortcutPrompt }
            </AccessibleButton>;
        } else if (this.props.isMinimized) {
            return <AccessibleButton
                onClick={this.openSearch}
                className="mx_RoomSearch mx_RoomSearch_minimized"
                title={_t("Filter rooms and people")}
                inputRef={this.elementRef}
            >
                { icon }
            </AccessibleButton>;
        }

        return (
            <div className={classes} onClick={this.focus}>
                { icon }
                { input }
                { shortcutPrompt }
                <AccessibleButton
                    tabIndex={-1}
                    title={_t("Clear filter")}
                    className="mx_RoomSearch_clearButton"
                    onClick={this.clearInput}
                />
            </div>
        );
    }

    public appendChar(char: string): void {
        this.setState({
            query: this.state.query + char,
        });
    }

    public backspace(): void {
        this.setState({
            query: this.state.query.substring(0, this.state.query.length - 1),
        });
    }
}
