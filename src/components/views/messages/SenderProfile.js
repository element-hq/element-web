/*
 Copyright 2015, 2016 OpenMarket Ltd

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

import React from 'react';
import sdk from '../../../index';
import Flair from '../elements/Flair.js';
import { _t, substitute } from '../../../languageHandler';

export default function SenderProfile(props) {
    const EmojiText = sdk.getComponent('elements.EmojiText');
    const {mxEvent} = props;
    const name = mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender();
    const {msgtype} = mxEvent.getContent();

    if (msgtype === 'm.emote') {
        return <span />; // emote message must include the name so don't duplicate it
    }

    // Name + flair
    const nameElem = [
        <EmojiText key='name' className="mx_SenderProfile_name">{ name || '' }</EmojiText>,
        props.enableFlair ?
            <Flair key='flair'
                userId={mxEvent.getSender()}
                roomId={mxEvent.getRoomId()}
                showRelated={true} />
            : null,
    ];

    let content;
    if(props.text) {
        content = _t(props.text, { senderName: () => nameElem });
    } else {
        // There is nothing to translate here, so call substitute() instead
        content = substitute('%(senderName)s', { senderName: () => nameElem });
    }

    return (
        <div className="mx_SenderProfile" dir="auto" onClick={props.onClick}>
            // The text surrounding the user name must be wrapped in order for it to have the correct opacity.
            // It is not possible to wrap the whole thing, because the user name might contain flair which should
            // be shown at full opacity. Sadly CSS does not make it possible to "reset" opacity so we have to do it
            // in parts like this. Sometimes CSS makes me a sad panda :-(
            // XXX: This could be avoided if the actual colour is set, rather than faking it with opacity
            { content.props.children[0] ?
                <span className='mx_SenderProfile_aux'>{ content.props.children[0] }</span> : ''
            }
            { content.props.children[1] }
            { content.props.children[2] ?
                <span className='mx_SenderProfile_aux'>{ content.props.children[2] }</span> : ''
            }
        </div>
    );
}

SenderProfile.propTypes = {
    mxEvent: React.PropTypes.object.isRequired, // event whose sender we're showing
    text: React.PropTypes.string, // Text to show. Defaults to sender name
    onClick: React.PropTypes.func,
};
