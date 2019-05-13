/*
Copyright 2019 New Vector Ltd

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
import sdk from '../../../index';
import dis from '../../../dispatcher';
import Modal from '../../../Modal';
import { createMenu } from '../../structures/ContextualMenu';
import SettingsStore from '../../../settings/SettingsStore';
import { isContentActionable } from '../../../utils/EventUtils';

export default class MessageActionBar extends React.PureComponent {
    static propTypes = {
        mxEvent: PropTypes.object.isRequired,
        // The Relations model from the JS SDK for reactions to `mxEvent`
        reactions: PropTypes.object,
        permalinkCreator: PropTypes.object,
        getTile: PropTypes.func,
        getReplyThread: PropTypes.func,
        onFocusChange: PropTypes.func,
    };

    onFocusChange = (focused) => {
        if (!this.props.onFocusChange) {
            return;
        }
        this.props.onFocusChange(focused);
    }

    onCryptoClicked = () => {
        const event = this.props.mxEvent;
        Modal.createTrackedDialogAsync('Encrypted Event Dialog', '',
            import('../../../async-components/views/dialogs/EncryptedEventDialog'),
            {event},
        );
    }

    onReplyClick = (ev) => {
        dis.dispatch({
            action: 'reply_to_event',
            event: this.props.mxEvent,
        });
    }

    onOptionsClick = (ev) => {
        const MessageContextMenu = sdk.getComponent('context_menus.MessageContextMenu');
        const buttonRect = ev.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const x = buttonRect.right + window.pageXOffset;
        const y = (buttonRect.top + (buttonRect.height / 2) + window.pageYOffset) - 19;

        const { getTile, getReplyThread } = this.props;
        const tile = getTile && getTile();
        const replyThread = getReplyThread && getReplyThread();

        let e2eInfoCallback = null;
        if (this.props.mxEvent.isEncrypted()) {
            e2eInfoCallback = () => this.onCryptoClicked();
        }

        createMenu(MessageContextMenu, {
            chevronOffset: 10,
            mxEvent: this.props.mxEvent,
            left: x,
            top: y,
            permalinkCreator: this.props.permalinkCreator,
            eventTileOps: tile && tile.getEventTileOps ? tile.getEventTileOps() : undefined,
            collapseReplyThread: replyThread && replyThread.canCollapse() ? replyThread.collapse : undefined,
            e2eInfoCallback: e2eInfoCallback,
            onFinished: () => {
                this.onFocusChange(false);
            },
        });

        this.onFocusChange(true);
    }

    isReactionsEnabled() {
        return SettingsStore.isFeatureEnabled("feature_reactions");
    }

    renderAgreeDimension() {
        if (!this.isReactionsEnabled()) {
            return null;
        }

        const ReactionDimension = sdk.getComponent('messages.ReactionDimension');
        return <ReactionDimension
            title={_t("Agree or Disagree")}
            options={["👍", "👎"]}
            reactions={this.props.reactions}
            mxEvent={this.props.mxEvent}
        />;
    }

    renderLikeDimension() {
        if (!this.isReactionsEnabled()) {
            return null;
        }

        const ReactionDimension = sdk.getComponent('messages.ReactionDimension');
        return <ReactionDimension
            title={_t("Like or Dislike")}
            options={["🙂", "😔"]}
            reactions={this.props.reactions}
            mxEvent={this.props.mxEvent}
        />;
    }

    render() {
        let agreeDimensionReactionButtons;
        let likeDimensionReactionButtons;
        let replyButton;

        if (isContentActionable(this.props.mxEvent)) {
            agreeDimensionReactionButtons = this.renderAgreeDimension();
            likeDimensionReactionButtons = this.renderLikeDimension();
            replyButton = <span className="mx_MessageActionBar_maskButton mx_MessageActionBar_replyButton"
                title={_t("Reply")}
                onClick={this.onReplyClick}
            />;
        }

        return <div className="mx_MessageActionBar">
            {agreeDimensionReactionButtons}
            {likeDimensionReactionButtons}
            {replyButton}
            <span className="mx_MessageActionBar_maskButton mx_MessageActionBar_optionsButton"
                title={_t("Options")}
                onClick={this.onOptionsClick}
            />
        </div>;
    }
}
