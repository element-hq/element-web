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

import React, { ChangeEvent, createRef } from 'react';

import { _t } from '../../../languageHandler';
import AccessibleButton from "./AccessibleButton";

interface IProps {
    className?: string;
    onChange?: (value: string) => void;
    onClear?: () => void;
    onJoinClick?: (value: string) => void;
    placeholder?: string;
    showJoinButton?: boolean;
    initialText?: string;
}

interface IState {
    value: string;
}

export default class DirectorySearchBox extends React.Component<IProps, IState> {
    private input = createRef<HTMLInputElement>();

    constructor(props: IProps) {
        super(props);

        this.state = {
            value: this.props.initialText || '',
        };
    }

    private onClearClick = (): void => {
        this.setState({ value: '' });

        if (this.input.current) {
            this.input.current.focus();

            if (this.props.onClear) {
                this.props.onClear();
            }
        }
    };

    private onChange = (ev: ChangeEvent<HTMLInputElement>): void => {
        if (!this.input.current) return;
        this.setState({ value: ev.target.value });

        if (this.props.onChange) {
            this.props.onChange(ev.target.value);
        }
    };

    private onKeyUp = (ev: React.KeyboardEvent): void => {
        if (ev.key == 'Enter' && this.props.showJoinButton) {
            if (this.props.onJoinClick) {
                this.props.onJoinClick(this.state.value);
            }
        }
    };

    private onJoinButtonClick = (): void => {
        if (this.props.onJoinClick) {
            this.props.onJoinClick(this.state.value);
        }
    };

    public render(): JSX.Element {
        const searchboxClasses = {
            mx_DirectorySearchBox: true,
        };
        searchboxClasses[this.props.className] = true;

        let joinButton;
        if (this.props.showJoinButton) {
            joinButton = <AccessibleButton className="mx_DirectorySearchBox_joinButton"
                onClick={this.onJoinButtonClick}
            >{ _t("Join") }</AccessibleButton>;
        }

        return <div className={`mx_DirectorySearchBox ${this.props.className} mx_textinput`}>
            <input
                type="text"
                name="dirsearch"
                value={this.state.value}
                className="mx_textinput_icon mx_textinput_search"
                ref={this.input}
                onChange={this.onChange}
                onKeyUp={this.onKeyUp}
                placeholder={this.props.placeholder}
                autoFocus
            />
            { joinButton }
            <AccessibleButton className="mx_DirectorySearchBox_clear" onClick={this.onClearClick} />
        </div>;
    }
}

