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
import MImageBody from './MImageBody';
import * as sdk from '../../../index';

export default class MStickerBody extends MImageBody {
    // Mostly empty to prevent default behaviour of MImageBody
    onClick(ev) {
        ev.preventDefault();
        if (!this.state.showImage) {
            this.showImage();
        }
    }

    // MStickerBody doesn't need a wrapping `<a href=...>`, but it does need extra padding
    // which is added by mx_MStickerBody_wrapper
    wrapImage(contentUrl, children) {
        let onClick = null;
        if (!this.state.showImage) {
            onClick = this.onClick;
        }
        return <div className="mx_MStickerBody_wrapper" onClick={onClick}> { children } </div>;
    }

    // Placeholder to show in place of the sticker image if
    // img onLoad hasn't fired yet.
    getPlaceholder() {
        const TintableSVG = sdk.getComponent('elements.TintableSvg');
        return <TintableSVG src={require("../../../../res/img/icons-show-stickers.svg")} width="75" height="75" />;
    }

    // Tooltip to show on mouse over
    getTooltip() {
        const content = this.props.mxEvent && this.props.mxEvent.getContent();

        if (!content || !content.body || !content.info || !content.info.w) return null;

        const Tooltip = sdk.getComponent('elements.Tooltip');
        return <div style={{left: content.info.w + 'px'}} className="mx_MStickerBody_tooltip">
            <Tooltip label={content.body} />
        </div>;
    }

    // Don't show "Download this_file.png ..."
    getFileBody() {
        return null;
    }
}
