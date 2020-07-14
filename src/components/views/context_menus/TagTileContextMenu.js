/*
Copyright 2018 New Vector Ltd
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
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';
import dis from '../../../dispatcher/dispatcher';
import TagOrderActions from '../../../actions/TagOrderActions';
import * as sdk from '../../../index';
import {MenuItem} from "../../structures/ContextMenu";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

export default class TagTileContextMenu extends React.Component {
    static propTypes = {
        tag: PropTypes.string.isRequired,
        /* callback called when the menu is dismissed */
        onFinished: PropTypes.func.isRequired,
    };

    static contextType = MatrixClientContext;

    constructor() {
        super();

        this._onViewCommunityClick = this._onViewCommunityClick.bind(this);
        this._onRemoveClick = this._onRemoveClick.bind(this);
    }

    _onViewCommunityClick() {
        dis.dispatch({
            action: 'view_group',
            group_id: this.props.tag,
        });
        this.props.onFinished();
    }

    _onRemoveClick() {
        dis.dispatch(TagOrderActions.removeTag(this.context, this.props.tag));
        this.props.onFinished();
    }

    render() {
        const TintableSvg = sdk.getComponent("elements.TintableSvg");

        return <div>
            <MenuItem className="mx_TagTileContextMenu_item" onClick={this._onViewCommunityClick}>
                <TintableSvg
                    className="mx_TagTileContextMenu_item_icon"
                    src={require("../../../../res/img/icons-groups.svg")}
                    width="15"
                    height="15"
                />
                { _t('View Community') }
            </MenuItem>
            <hr className="mx_TagTileContextMenu_separator" role="separator" />
            <MenuItem className="mx_TagTileContextMenu_item" onClick={this._onRemoveClick}>
                <img className="mx_TagTileContextMenu_item_icon" src={require("../../../../res/img/icon_context_delete.svg")} width="15" height="15" alt="" />
                { _t('Hide') }
            </MenuItem>
        </div>;
    }
}
