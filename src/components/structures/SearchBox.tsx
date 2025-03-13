/*
Copyright 2024 New Vector Ltd.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef, type HTMLProps } from "react";
import { throttle } from "lodash";
import classNames from "classnames";

import AccessibleButton from "../../components/views/elements/AccessibleButton";
import { getKeyBindingsManager } from "../../KeyBindingsManager";
import { KeyBindingAction } from "../../accessibility/KeyboardShortcuts";

interface IProps extends HTMLProps<HTMLInputElement> {
    onSearch: (query: string) => void;
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
}

interface IState {
    searchTerm: string;
    blurred: boolean;
}

export default class SearchBox extends React.Component<IProps, IState> {
    private search = createRef<HTMLInputElement>();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            searchTerm: props.initialValue || "",
            blurred: true,
        };
    }

    private onChange = (): void => {
        if (!this.search.current) return;
        this.setState({ searchTerm: this.search.current.value });
        this.onSearch();
    };

    private onSearch = throttle(
        (): void => {
            this.props.onSearch(this.search.current?.value ?? "");
        },
        200,
        { trailing: true, leading: true },
    );

    private onKeyDown = (ev: React.KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (action) {
            case KeyBindingAction.Escape:
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
        if (this.search.current) this.search.current.value = "";
        this.onChange();
        this.props.onCleared?.(source);
    }

    public render(): React.ReactNode {
        /* eslint @typescript-eslint/no-unused-vars: ["error", { "ignoreRestSiblings": true }] */
        const {
            onSearch,
            onCleared,
            onKeyDown,
            onFocus,
            onBlur,
            className = "",
            placeholder,
            blurredPlaceholder,
            autoFocus,
            initialValue,
            collapsed,
            ...props
        } = this.props;

        // check for collapsed here and
        // not at parent so we keep
        // searchTerm in our state
        // when collapsing and expanding
        if (collapsed) {
            return null;
        }
        const clearButton =
            !this.state.blurred || this.state.searchTerm ? (
                <AccessibleButton
                    key="button"
                    tabIndex={-1}
                    className="mx_SearchBox_closeButton"
                    onClick={() => {
                        this.clearSearch("button");
                    }}
                />
            ) : undefined;

        // show a shorter placeholder when blurred, if requested
        // this is used for the room filter field that has
        // the explore button next to it when blurred
        return (
            <div className={classNames("mx_SearchBox", "mx_textinput", { mx_SearchBox_blurred: this.state.blurred })}>
                <input
                    {...props}
                    key="searchfield"
                    type="text"
                    ref={this.search}
                    className={"mx_textinput_icon mx_textinput_search " + className}
                    value={this.state.searchTerm}
                    onFocus={this.onFocus}
                    onChange={this.onChange}
                    onKeyDown={this.onKeyDown}
                    onBlur={this.onBlur}
                    placeholder={this.state.blurred ? blurredPlaceholder || placeholder : placeholder}
                    autoComplete="off"
                    autoFocus={this.props.autoFocus}
                    data-testid="searchbox-input"
                />
                {clearButton}
            </div>
        );
    }
}
