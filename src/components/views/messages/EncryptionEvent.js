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
import PropTypes from 'prop-types';
import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import EventTileBubble from "./EventTileBubble";

export default class EncryptionEvent extends React.Component {
    render() {
        const {mxEvent} = this.props;

        const isRoomEncrypted = MatrixClientPeg.get().isRoomEncrypted(mxEvent.getRoomId());
        if (mxEvent.getContent().algorithm === 'm.megolm.v1.aes-sha2' && isRoomEncrypted) {
            return <EventTileBubble
                className="mx_cryptoEvent mx_cryptoEvent_icon"
                title={_t("Encryption enabled")}
                subtitle={_t(
                    "Messages in this room are end-to-end encrypted. " +
                    "Learn more & verify this user in their user profile.",
                )}
            />;
        } else if (isRoomEncrypted) {
            return <EventTileBubble
                className="mx_cryptoEvent mx_cryptoEvent_icon"
                title={_t("Encryption enabled")}
                subtitle={_t("Ignored attempt to disable encryption")}
            />;
        }

        return <EventTileBubble
            className="mx_cryptoEvent mx_cryptoEvent_icon mx_cryptoEvent_icon_warning"
            title={_t("Encryption not enabled")}
            subtitle={_t("The encryption used by this room isn't supported.")}
        />;
    }
}

EncryptionEvent.propTypes = {
    /* the MatrixEvent to show */
    mxEvent: PropTypes.object.isRequired,
};
