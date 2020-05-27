/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import {_t} from "../../../languageHandler";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import {replaceableComponent} from "../../../utils/replaceableComponent";

@replaceableComponent("views.room_settings.RoomPublishSetting")
export default class RoomPublishSetting extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {isRoomPublished: false};
    }

    onRoomPublishChange = (e) => {
        const valueBefore = this.state.isRoomPublished;
        const newValue = !valueBefore;
        this.setState({isRoomPublished: newValue});
        const client = MatrixClientPeg.get();

        client.setRoomDirectoryVisibility(
            this.props.roomId,
            newValue ? 'public' : 'private',
        ).catch(() => {
            // Roll back the local echo on the change
            this.setState({isRoomPublished: valueBefore});
        });
    };

    componentDidMount() {
        const client = MatrixClientPeg.get();
        client.getRoomDirectoryVisibility(this.props.roomId).then((result => {
            this.setState({isRoomPublished: result.visibility === 'public'});
        }));
    }

    render() {
        const client = MatrixClientPeg.get();

        return (<LabelledToggleSwitch value={this.state.isRoomPublished}
            onChange={this.onRoomPublishChange}
            disabled={!this.props.canSetCanonicalAlias}
            label={_t("Publish this room to the public in %(domain)s's room directory?", {
              domain: client.getDomain(),
            })} />);
    }
}
