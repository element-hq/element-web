/*
Copyright 2018 New Vector Ltd

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
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';
import MatrixClientPeg from '../../../MatrixClientPeg';
import AccessibleButton from '../elements/AccessibleButton';
import classNames from 'classnames';

export default class StatusMessageContextMenu extends React.Component {
    static propTypes = {
        // js-sdk User object. Not required because it might not exist.
        user: PropTypes.object,
    };

    constructor(props, context) {
        super(props, context);

        this.state = {
            message: props.user ? props.user._unstable_statusMessage : "",
        };
    }

    _onClearClick = async(e) => {
        await MatrixClientPeg.get()._unstable_setStatusMessage("");
        this.setState({message: ""});
    };

    _onSubmit = (e) => {
        e.preventDefault();
        MatrixClientPeg.get()._unstable_setStatusMessage(this.state.message);
    };

    _onStatusChange = (e) => {
        this.setState({message: e.target.value});
    };

    render() {
        const formSubmitClasses = classNames({
            "mx_StatusMessageContextMenu_submit": true,
            "mx_StatusMessageContextMenu_submitFaded": !this.state.message, // no message == faded
        });

        const form = <form className="mx_StatusMessageContextMenu_form" onSubmit={this._onSubmit} autoComplete="off">
            <input type="text" key="message" placeholder={_t("Set a new status...")} autoFocus={true}
                   className="mx_StatusMessageContextMenu_message"
                   value={this.state.message} onChange={this._onStatusChange} maxLength="60" />
            <AccessibleButton onClick={this._onSubmit} element="div" className={formSubmitClasses}>
                <img src="img/icons-checkmark.svg" width="22" height="22" />
            </AccessibleButton>
        </form>;

        const clearIcon = this.state.message ? "img/cancel-red.svg" : "img/cancel.svg";
        const clearButton = <AccessibleButton onClick={this._onClearClick} disabled={!this.state.message}
                                              className="mx_StatusMessageContextMenu_clear">
            <img src={clearIcon} alt={_t('Clear status')} width="12" height="12"
                 className="mx_filterFlipColor mx_StatusMessageContextMenu_clearIcon" />
            <span>{_t("Clear status")}</span>
        </AccessibleButton>;

        const menuClasses = classNames({
            "mx_StatusMessageContextMenu": true,
            "mx_StatusMessageContextMenu_hasStatus": this.state.message,
        });

        return <div className={menuClasses}>
            { form }
            <hr />
            { clearButton }
        </div>;
    }
}
