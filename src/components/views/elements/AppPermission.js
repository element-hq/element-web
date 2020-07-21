/*
Copyright 2017 Vector Creations Ltd
Copyright 2018, 2019 New Vector Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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
import url from 'url';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import SdkConfig from '../../../SdkConfig';
import WidgetUtils from "../../../utils/WidgetUtils";
import {MatrixClientPeg} from "../../../MatrixClientPeg";

export default class AppPermission extends React.Component {
    static propTypes = {
        url: PropTypes.string.isRequired,
        creatorUserId: PropTypes.string.isRequired,
        roomId: PropTypes.string.isRequired,
        onPermissionGranted: PropTypes.func.isRequired,
        isRoomEncrypted: PropTypes.bool,
    };

    static defaultProps = {
        onPermissionGranted: () => {},
    };

    constructor(props) {
        super(props);

        // The first step is to pick apart the widget so we can render information about it
        const urlInfo = this.parseWidgetUrl();

        // The second step is to find the user's profile so we can show it on the prompt
        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        let roomMember;
        if (room) roomMember = room.getMember(this.props.creatorUserId);

        // Set all this into the initial state
        this.state = {
            ...urlInfo,
            roomMember,
        };
    }

    parseWidgetUrl() {
        const widgetUrl = url.parse(this.props.url);
        const params = new URLSearchParams(widgetUrl.search);

        // HACK: We're relying on the query params when we should be relying on the widget's `data`.
        // This is a workaround for Scalar.
        if (WidgetUtils.isScalarUrl(widgetUrl) && params && params.get('url')) {
            const unwrappedUrl = url.parse(params.get('url'));
            return {
                widgetDomain: unwrappedUrl.host || unwrappedUrl.hostname,
                isWrapped: true,
            };
        } else {
            return {
                widgetDomain: widgetUrl.host || widgetUrl.hostname,
                isWrapped: false,
            };
        }
    }

    render() {
        const brand = SdkConfig.get().brand;
        const AccessibleButton = sdk.getComponent("views.elements.AccessibleButton");
        const MemberAvatar = sdk.getComponent("views.avatars.MemberAvatar");
        const BaseAvatar = sdk.getComponent("views.avatars.BaseAvatar");
        const TextWithTooltip = sdk.getComponent("views.elements.TextWithTooltip");

        const displayName = this.state.roomMember ? this.state.roomMember.name : this.props.creatorUserId;
        const userId = displayName === this.props.creatorUserId ? null : this.props.creatorUserId;

        const avatar = this.state.roomMember
            ? <MemberAvatar member={this.state.roomMember} width={38} height={38} />
            : <BaseAvatar name={this.props.creatorUserId} width={38} height={38} />;

        const warningTooltipText = (
            <div>
                {_t("Any of the following data may be shared:")}
                <ul>
                    <li>{_t("Your display name")}</li>
                    <li>{_t("Your avatar URL")}</li>
                    <li>{_t("Your user ID")}</li>
                    <li>{_t("Your theme")}</li>
                    <li>{_t("%(brand)s URL", { brand })}</li>
                    <li>{_t("Room ID")}</li>
                    <li>{_t("Widget ID")}</li>
                </ul>
            </div>
        );
        const warningTooltip = (
            <TextWithTooltip tooltip={warningTooltipText} tooltipClass='mx_AppPermissionWarning_tooltip mx_Tooltip_dark'>
                <span className='mx_AppPermissionWarning_helpIcon' />
            </TextWithTooltip>
        );

        // Due to i18n limitations, we can't dedupe the code for variables in these two messages.
        const warning = this.state.isWrapped
            ? _t("Using this widget may share data <helpIcon /> with %(widgetDomain)s & your Integration Manager.",
                {widgetDomain: this.state.widgetDomain}, {helpIcon: () => warningTooltip})
            : _t("Using this widget may share data <helpIcon /> with %(widgetDomain)s.",
                {widgetDomain: this.state.widgetDomain}, {helpIcon: () => warningTooltip});

        const encryptionWarning = this.props.isRoomEncrypted ? _t("Widgets do not use message encryption.") : null;

        return (
            <div className='mx_AppPermissionWarning'>
                <div className='mx_AppPermissionWarning_row mx_AppPermissionWarning_bolder mx_AppPermissionWarning_smallText'>
                    {_t("Widget added by")}
                </div>
                <div className='mx_AppPermissionWarning_row'>
                    {avatar}
                    <h4 className='mx_AppPermissionWarning_bolder'>{displayName}</h4>
                    <div className='mx_AppPermissionWarning_smallText'>{userId}</div>
                </div>
                <div className='mx_AppPermissionWarning_row mx_AppPermissionWarning_smallText'>
                    {warning}
                </div>
                <div className='mx_AppPermissionWarning_row mx_AppPermissionWarning_smallText'>
                    {_t("This widget may use cookies.")}&nbsp;{encryptionWarning}
                </div>
                <div className='mx_AppPermissionWarning_row'>
                    <AccessibleButton kind='primary_sm' onClick={this.props.onPermissionGranted}>
                        {_t("Continue")}
                    </AccessibleButton>
                </div>
            </div>
        );
    }
}
