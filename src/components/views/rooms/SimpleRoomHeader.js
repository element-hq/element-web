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

import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import AccessibleButton from '../elements/AccessibleButton';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';

// cancel button which is shared between room header and simple room header
export function CancelButton(props) {
    const {onClick} = props;

    return (
        <AccessibleButton className='mx_RoomHeader_cancelButton' onClick={onClick}>
            <img src={require("../../../../res/img/cancel.svg")} className='mx_filterFlipColor'
                width="18" height="18" alt={_t("Cancel")} />
        </AccessibleButton>
    );
}

/*
 * A stripped-down room header used for things like the user settings
 * and room directory.
 */
export default createReactClass({
    displayName: 'SimpleRoomHeader',

    propTypes: {
        title: PropTypes.string,
        onCancelClick: PropTypes.func,

        // `src` to a TintableSvg. Optional.
        icon: PropTypes.string,
    },

    render: function() {
        let cancelButton;
        let icon;
        if (this.props.onCancelClick) {
            cancelButton = <CancelButton onClick={this.props.onCancelClick} />;
        }
        if (this.props.icon) {
            const TintableSvg = sdk.getComponent('elements.TintableSvg');
            icon = <TintableSvg
                className="mx_RoomHeader_icon" src={this.props.icon}
                width="25" height="25"
            />;
        }

        return (
            <div className="mx_RoomHeader" >
                <div className="mx_RoomHeader_wrapper">
                    <div className="mx_RoomHeader_simpleHeader">
                        { icon }
                        { this.props.title }
                        { cancelButton }
                    </div>
                </div>
            </div>
        );
    },
});
