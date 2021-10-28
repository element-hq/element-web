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

import React, { createRef } from 'react';
import classNames from 'classnames';

import { _t } from '../../../languageHandler';
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { replaceableComponent } from "../../../utils/replaceableComponent";

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

@replaceableComponent("views.rooms.MessageComposerFormatBar")
export default class MessageComposerFormatBar extends React.PureComponent<IProps, IState> {
    private readonly formatBarRef = createRef<HTMLDivElement>();

    constructor(props: IProps) {
        super(props);
        this.state = { visible: false };
    }

    render() {
        const classes = classNames("mx_MessageComposerFormatBar", {
            "mx_MessageComposerFormatBar_shown": this.state.visible,
        });
        return (<div className={classes} ref={this.formatBarRef}>
            <FormatButton label={_t("Bold")} onClick={() => this.props.onAction(Formatting.Bold)} icon="Bold" shortcut={this.props.shortcuts.bold} visible={this.state.visible} />
            <FormatButton label={_t("Italics")} onClick={() => this.props.onAction(Formatting.Italics)} icon="Italic" shortcut={this.props.shortcuts.italics} visible={this.state.visible} />
            <FormatButton label={_t("Strikethrough")} onClick={() => this.props.onAction(Formatting.Strikethrough)} icon="Strikethrough" visible={this.state.visible} />
            <FormatButton label={_t("Code block")} onClick={() => this.props.onAction(Formatting.Code)} icon="Code" visible={this.state.visible} />
            <FormatButton label={_t("Quote")} onClick={() => this.props.onAction(Formatting.Quote)} icon="Quote" shortcut={this.props.shortcuts.quote} visible={this.state.visible} />
            <FormatButton label={_t("Insert link")} onClick={() => this.props.onAction(Formatting.InsertLink)} icon="InsertLink" visible={this.state.visible} />
        </div>);
    }

    public showAt(selectionRect: DOMRect): void {
        if (!this.formatBarRef.current) return;

        this.setState({ visible: true });
        const parentRect = this.formatBarRef.current.parentElement.getBoundingClientRect();
        this.formatBarRef.current.style.left = `${selectionRect.left - parentRect.left}px`;
        // 16 is half the height of the bar (e.g. to center it) and 18 is an offset that felt ok.
        this.formatBarRef.current.style.top = `${selectionRect.top - parentRect.top - 16 - 18}px`;
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
    render() {
        const className = `mx_MessageComposerFormatBar_button mx_MessageComposerFormatBar_buttonIcon${this.props.icon}`;
        let shortcut;
        if (this.props.shortcut) {
            shortcut = <div className="mx_MessageComposerFormatBar_tooltipShortcut">
                { this.props.shortcut }
            </div>;
        }
        const tooltip = <div>
            <div className="mx_Tooltip_title">
                { this.props.label }
            </div>
            <div className="mx_Tooltip_sub">
                { shortcut }
            </div>
        </div>;

        return (
            <AccessibleTooltipButton
                onClick={this.props.onClick}
                title={this.props.label}
                tooltip={tooltip}
                className={className} />
        );
    }
}
