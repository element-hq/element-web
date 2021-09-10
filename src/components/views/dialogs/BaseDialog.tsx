/*
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import FocusLock from 'react-focus-lock';
import classNames from 'classnames';

import { Key } from '../../../Keyboard';
import AccessibleButton, { ButtonEvent } from '../elements/AccessibleButton';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { _t } from "../../../languageHandler";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { IDialogProps } from "./IDialogProps";

interface IProps extends IDialogProps {
    // Whether the dialog should have a 'close' button that will
    // cause the dialog to be cancelled. This should only be set
    // to false if there is nothing the app can sensibly do if the
    // dialog is cancelled, eg. "We can't restore your session and
    // the app cannot work". Default: true.
    hasCancel?: boolean;

    // called when a key is pressed
    onKeyDown?: (e: KeyboardEvent | React.KeyboardEvent) => void;

    // CSS class to apply to dialog div
    className?: string;

    // if true, dialog container is 60% of the viewport width. Otherwise,
    // the container will have no fixed size, allowing its contents to
    // determine its size. Default: true.
    fixedWidth?: boolean;

    // Title for the dialog.
    title?: JSX.Element | string;

    // Path to an icon to put in the header
    headerImage?: string;

    // children should be the content of the dialog
    children?: React.ReactNode;

    // Id of content element
    // If provided, this is used to add a aria-describedby attribute
    contentId?: string;

    // optional additional class for the title element (basically anything that can be passed to classnames)
    titleClass?: string | string[];

    headerButton?: JSX.Element;
}

/*
 * Basic container for modal dialogs.
 *
 * Includes a div for the title, and a keypress handler which cancels the
 * dialog on escape.
 */
@replaceableComponent("views.dialogs.BaseDialog")
export default class BaseDialog extends React.Component<IProps> {
    private matrixClient: MatrixClient;

    public static defaultProps = {
        hasCancel: true,
        fixedWidth: true,
    };

    constructor(props) {
        super(props);

        this.matrixClient = MatrixClientPeg.get();
    }

    private onKeyDown = (e: KeyboardEvent | React.KeyboardEvent): void => {
        if (this.props.onKeyDown) {
            this.props.onKeyDown(e);
        }
        if (this.props.hasCancel && e.key === Key.ESCAPE) {
            e.stopPropagation();
            e.preventDefault();
            this.props.onFinished(false);
        }
    };

    private onCancelClick = (e: ButtonEvent): void => {
        this.props.onFinished(false);
    };

    public render(): JSX.Element {
        let cancelButton;
        if (this.props.hasCancel) {
            cancelButton = (
                <AccessibleButton onClick={this.onCancelClick} className="mx_Dialog_cancelButton" aria-label={_t("Close dialog")} />
            );
        }

        let headerImage;
        if (this.props.headerImage) {
            headerImage = <img className="mx_Dialog_titleImage" src={this.props.headerImage} alt="" />;
        }

        return (
            <MatrixClientContext.Provider value={this.matrixClient}>
                <FocusLock
                    returnFocus={true}
                    lockProps={{
                        onKeyDown: this.onKeyDown,
                        role: "dialog",
                        ["aria-labelledby"]: "mx_BaseDialog_title",
                        // This should point to a node describing the dialog.
                        // If we were about to completely follow this recommendation we'd need to
                        // make all the components relying on BaseDialog to be aware of it.
                        // So instead we will use the whole content as the description.
                        // Description comes first and if the content contains more text,
                        // AT users can skip its presentation.
                        ["aria-describedby"]: this.props.contentId,
                    }}
                    className={classNames({
                        [this.props.className]: true,
                        'mx_Dialog_fixedWidth': this.props.fixedWidth,
                    })}
                >
                    <div className={classNames('mx_Dialog_header', {
                        'mx_Dialog_headerWithButton': !!this.props.headerButton,
                        'mx_Dialog_headerWithCancel': !!cancelButton,
                    })}>
                        <div className={classNames('mx_Dialog_title', this.props.titleClass)} id='mx_BaseDialog_title'>
                            { headerImage }
                            { this.props.title }
                        </div>
                        { this.props.headerButton }
                        { cancelButton }
                    </div>
                    { this.props.children }
                </FocusLock>
            </MatrixClientContext.Provider>
        );
    }
}
