/*
Copyright 2020 New Vector Ltd

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
import { ContextMenu, IProps as IContextMenuProps, MenuItem } from '../../structures/ContextMenu';
import { MatrixCall } from 'matrix-js-sdk/src/webrtc/call';

interface IProps extends IContextMenuProps {
    call: MatrixCall;
}

export default class CallContextMenu extends React.Component<IProps> {
    static propTypes = {
        // js-sdk User object. Not required because it might not exist.
        user: PropTypes.object,
    };

    constructor(props) {
        super(props);
    }

    onHoldUnholdClick = () => {
        this.props.call.setRemoteOnHold(!this.props.call.isRemoteOnHold());
        this.props.onFinished();
    }

    render() {
        const holdUnholdCaption = this.props.call.isRemoteOnHold() ? _t("Resume") : _t("Hold");

        return <ContextMenu {...this.props}>
            <MenuItem className="mx_CallContextMenu_item" onClick={this.onHoldUnholdClick}>
                {holdUnholdCaption}
            </MenuItem>
        </ContextMenu>;
    }
}
