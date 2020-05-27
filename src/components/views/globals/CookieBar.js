/*
Copyright 2018 New Vector Ltd.

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
import dis from '../../../dispatcher/dispatcher';
import { _t } from '../../../languageHandler';
import * as sdk from '../../../index';
import Analytics from '../../../Analytics';

export default class CookieBar extends React.Component {
    static propTypes = {
        policyUrl: PropTypes.string,
    }

    constructor() {
        super();
    }

    onUsageDataClicked(e) {
        e.stopPropagation();
        e.preventDefault();
        Analytics.showDetailsModal();
    }

    onAccept() {
        dis.dispatch({
            action: 'accept_cookies',
        });
    }

    onReject() {
        dis.dispatch({
            action: 'reject_cookies',
        });
    }

    render() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        const toolbarClasses = "mx_MatrixToolbar";
        return (
            <div className={toolbarClasses}>
                <img className="mx_MatrixToolbar_warning" src={require("../../../../res/img/warning.svg")} width="24" height="23" alt="" />
                <div className="mx_MatrixToolbar_content">
                    { this.props.policyUrl ? _t(
                        "Please help improve Riot.im by sending <UsageDataLink>anonymous usage data</UsageDataLink>. " +
                        "This will use a cookie " +
                        "(please see our <PolicyLink>Cookie Policy</PolicyLink>).",
                        {},
                        {
                            'UsageDataLink': (sub) => <a
                                className="mx_MatrixToolbar_link"
                                onClick={this.onUsageDataClicked}
                            >
                                { sub }
                            </a>,
                            // XXX: We need to link to the page that explains our cookies
                            'PolicyLink': (sub) => <a
                                    className="mx_MatrixToolbar_link"
                                    target="_blank"
                                    href={this.props.policyUrl}
                                >
                                    { sub }
                                </a>
                            ,
                        },
                    ) : _t(
                        "Please help improve Riot.im by sending <UsageDataLink>anonymous usage data</UsageDataLink>. " +
                        "This will use a cookie.",
                        {},
                        {
                            'UsageDataLink': (sub) => <a
                                className="mx_MatrixToolbar_link"
                                onClick={this.onUsageDataClicked}
                            >
                                { sub }
                            </a>,
                        },
                    ) }
                </div>
                <AccessibleButton element='button' className="mx_MatrixToolbar_action" onClick={this.onAccept}>
                    { _t("Yes, I want to help!") }
                </AccessibleButton>
                <AccessibleButton className="mx_MatrixToolbar_close" onClick={this.onReject}>
                    <img src={require("../../../../res/img/cancel.svg")} width="18" height="18" alt={_t('Close')} />
                </AccessibleButton>
            </div>
        );
    }
}
