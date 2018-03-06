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

'use strict';

import MImageBody from "./MImageBody";
import sdk from '../../../index';

export default class MStickerBody extends MImageBody {
    displayName: 'MStickerBody'

    constructor(props) {
      super(props);

      this._onMouseEnter = this._onMouseEnter.bind(this);
      this._onMouseLeave = this._onMouseLeave.bind(this);
    }

    _onMouseEnter() {
        this.setState({showTooltip: true});
    }

    _onMouseLeave() {
        this.setState({showTooltip: false});
    }

    _messageContent(contentUrl, thumbUrl, content) {
        let tooltip;
        const tooltipBody = (
            this.props.mxEvent &&
            this.props.mxEvent.getContent() &&
            this.props.mxEvent.getContent().body) ?
            this.props.mxEvent.getContent().body : null;
        if (this.state.showTooltip && tooltipBody) {
            const RoomTooltip = sdk.getComponent("rooms.RoomTooltip");
            tooltip = <RoomTooltip
                className="mx_RoleButton_tooltip"
                label={tooltipBody} />;
        }

        return (
            <span className="mx_MImageBody" ref="body">
                <div className="mx_MImageBody_thumbnail_container">
                    <img className="mx_MImageBody_thumbnail" src={thumbUrl} ref="image"
                        alt={content.body}
                        onLoad={this.props.onWidgetLoad}
                        onMouseEnter={this._onMouseEnter}
                        onMouseLeave={this._onMouseLeave}
                    />
                    { tooltip }
                </div>
            </span>
        );
    }

    onClick() {
    }
}
