/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

import React, { createRef } from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import { RovingAccessibleButton } from "../../../accessibility/RovingTabIndex";
import Toolbar from "../../../accessibility/Toolbar";

export enum Formatting {
    Bold = "bold",
    Italics = "italics",
    Strikethrough = "strikethrough",
    Code = "code",
    Quote = "quote",
    InsertLink = "insert_link",
}

interface IProps {
    shortcuts: Partial<Record<Formatting, string>>;
    onAction(action: Formatting): void;
}

interface IState {
    visible: boolean;
}

export default class MessageComposerFormatBar extends React.PureComponent<IProps, IState> {
    private readonly formatBarRef = createRef<HTMLDivElement>();

    public constructor(props: IProps) {
        super(props);
        this.state = { visible: false };
    }

    public render(): React.ReactNode {
        const classes = classNames("mx_MessageComposerFormatBar", {
            mx_MessageComposerFormatBar_shown: this.state.visible,
        });
        return (
            <Toolbar className={classes} ref={this.formatBarRef} aria-label={_t("composer|formatting_toolbar_label")}>
                <FormatButton
                    label={_t("composer|format_bold")}
                    onClick={() => this.props.onAction(Formatting.Bold)}
                    icon="Bold"
                    shortcut={this.props.shortcuts.bold}
                    visible={this.state.visible}
                />
                <FormatButton
                    label={_t("composer|format_italics")}
                    onClick={() => this.props.onAction(Formatting.Italics)}
                    icon="Italic"
                    shortcut={this.props.shortcuts.italics}
                    visible={this.state.visible}
                />
                <FormatButton
                    label={_t("composer|format_strikethrough")}
                    onClick={() => this.props.onAction(Formatting.Strikethrough)}
                    icon="Strikethrough"
                    visible={this.state.visible}
                />
                <FormatButton
                    label={_t("composer|format_code_block")}
                    onClick={() => this.props.onAction(Formatting.Code)}
                    icon="Code"
                    shortcut={this.props.shortcuts.code}
                    visible={this.state.visible}
                />
                <FormatButton
                    label={_t("action|quote")}
                    onClick={() => this.props.onAction(Formatting.Quote)}
                    icon="Quote"
                    shortcut={this.props.shortcuts.quote}
                    visible={this.state.visible}
                />
                <FormatButton
                    label={_t("composer|format_insert_link")}
                    onClick={() => this.props.onAction(Formatting.InsertLink)}
                    icon="InsertLink"
                    shortcut={this.props.shortcuts.insert_link}
                    visible={this.state.visible}
                />
            </Toolbar>
        );
    }

    public showAt(selectionRect: DOMRect): void {
        if (!this.formatBarRef.current?.parentElement) return;

        this.setState({ visible: true });
        const parentRect = this.formatBarRef.current.parentElement.getBoundingClientRect();
        this.formatBarRef.current.style.left = `${selectionRect.left - parentRect.left}px`;
        const halfBarHeight = this.formatBarRef.current.clientHeight / 2; // used to center the bar
        const offset = halfBarHeight + 2; // makes sure the bar won't cover selected text
        const offsetLimit = halfBarHeight + offset;
        const position = Math.max(selectionRect.top - parentRect.top - offsetLimit, -offsetLimit);
        this.formatBarRef.current.style.top = `${position}px`;
    }

    public hide(): void {
        this.setState({ visible: false });
    }
}

interface IFormatButtonProps {
    label: string;
    icon: string;
    shortcut?: string;
    visible?: boolean;
    onClick(): void;
}

class FormatButton extends React.PureComponent<IFormatButtonProps> {
    public render(): React.ReactNode {
        const className = `mx_MessageComposerFormatBar_button mx_MessageComposerFormatBar_buttonIcon${this.props.icon}`;

        // element="button" and type="button" are necessary for the buttons to work on WebKit,
        // otherwise the text is deselected before onClick can ever be called
        return (
            <RovingAccessibleButton
                element="button"
                type="button"
                onClick={this.props.onClick}
                aria-label={this.props.label}
                title={this.props.label}
                caption={this.props.shortcut}
                className={className}
            />
        );
    }
}
