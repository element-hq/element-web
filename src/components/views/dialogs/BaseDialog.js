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
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { Key } from '../../../Keyboard';
import AccessibleButton from '../elements/AccessibleButton';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import { _t } from "../../../languageHandler";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

/*
 * Basic container for modal dialogs.
 *
 * Includes a div for the title, and a keypress handler which cancels the
 * dialog on escape.
 */
export default class BaseDialog extends React.Component {
    static propTypes = {
        // onFinished callback to call when Escape is pressed
        // Take a boolean which is true if the dialog was dismissed
        // with a positive / confirm action or false if it was
        // cancelled (BaseDialog itself only calls this with false).
        onFinished: PropTypes.func.isRequired,

        // Whether the dialog should have a 'close' button that will
        // cause the dialog to be cancelled. This should only be set
        // to false if there is nothing the app can sensibly do if the
        // dialog is cancelled, eg. "We can't restore your session and
        // the app cannot work". Default: true.
        hasCancel: PropTypes.bool,

        // called when a key is pressed
        onKeyDown: PropTypes.func,

        // CSS class to apply to dialog div
        className: PropTypes.string,

        // if true, dialog container is 60% of the viewport width. Otherwise,
        // the container will have no fixed size, allowing its contents to
        // determine its size. Default: true.
        fixedWidth: PropTypes.bool,

        // Title for the dialog.
        title: PropTypes.node.isRequired,

        // Path to an icon to put in the header
        headerImage: PropTypes.string,

        // children should be the content of the dialog
        children: PropTypes.node,

        // Id of content element
        // If provided, this is used to add a aria-describedby attribute
        contentId: PropTypes.string,

        // optional additional class for the title element (basically anything that can be passed to classnames)
        titleClass: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.object,
            PropTypes.arrayOf(PropTypes.string),
        ]),
    };

    static defaultProps = {
        hasCancel: true,
        fixedWidth: true,
    };

    constructor(props) {
        super(props);

        this._matrixClient = MatrixClientPeg.get();
    }

    _onKeyDown = (e) => {
        if (this.props.onKeyDown) {
            this.props.onKeyDown(e);
        }
        if (this.props.hasCancel && e.key === Key.ESCAPE) {
            e.stopPropagation();
            e.preventDefault();
            this.props.onFinished(false);
        }
    };

    _onCancelClick = (e) => {
        this.props.onFinished(false);
    };

    render() {
        let cancelButton;
        if (this.props.hasCancel) {
            cancelButton = (
                <AccessibleButton onClick={this._onCancelClick} className="mx_Dialog_cancelButton" aria-label={_t("Close dialog")} />
            );
        }

        let headerImage;
        if (this.props.headerImage) {
            headerImage = <img className="mx_Dialog_titleImage" src={this.props.headerImage}
                alt=""
            />;
        }

        return (
            <MatrixClientContext.Provider value={this._matrixClient}>
                <FocusLock
                    returnFocus={true}
                    lockProps={{
                        onKeyDown: this._onKeyDown,
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
                            {headerImage}
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
