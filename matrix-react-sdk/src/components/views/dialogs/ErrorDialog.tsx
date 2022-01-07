/*
Copyright 2015, 2016 OpenMarket Ltd

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

/*
 * Usage:
 * Modal.createTrackedDialog('An Identifier', 'some detail', ErrorDialog, {
 *   title: "some text", (default: "Error")
 *   description: "some more text",
 *   button: "Button Text",
 *   onFinished: someFunction,
 *   focus: true|false (default: true)
 * });
 */

import React from 'react';

import { _t } from '../../../languageHandler';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import BaseDialog from "./BaseDialog";

interface IProps {
    onFinished: (success: boolean) => void;
    title?: string;
    description?: React.ReactNode;
    button?: string;
    focus?: boolean;
    headerImage?: string;
}

interface IState {
    onFinished: (success: boolean) => void;
}

@replaceableComponent("views.dialogs.ErrorDialog")
export default class ErrorDialog extends React.Component<IProps, IState> {
    public static defaultProps = {
        focus: true,
        title: null,
        description: null,
        button: null,
    };

    private onClick = () => {
        this.props.onFinished(true);
    };

    public render() {
        return (
            <BaseDialog
                className="mx_ErrorDialog"
                onFinished={this.props.onFinished}
                title={this.props.title || _t('Error')}
                headerImage={this.props.headerImage}
                contentId='mx_Dialog_content'
            >
                <div className="mx_Dialog_content" id='mx_Dialog_content'>
                    { this.props.description || _t('An error has occurred.') }
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this.onClick} autoFocus={this.props.focus}>
                        { this.props.button || _t('OK') }
                    </button>
                </div>
            </BaseDialog>
        );
    }
}
