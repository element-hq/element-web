'use strict';

import React from 'react';

module.exports = React.createClass({
    displayName: 'Spoiler',

    getInitialState() {
        return {
            visible: false,
        };
    },

    toggleVisible() {
        this.setState({ visible: !this.state.visible });
    },

    render: function() {
        const reason = this.props.reason ? (
            <span className="mx_EventTile_spoiler_reason">{"(" + this.props.reason + ")"}</span>
        ) : null;
        return (
            <span className={"mx_EventTile_spoiler" + (this.state.visible ? " visible" : "")} onClick={this.toggleVisible.bind(this)}>
                { reason }
                &nbsp;
                <span className="mx_EventTile_spoiler_content" dangerouslySetInnerHTML={{ __html: this.props.contentHtml }} />
            </span>
        );
    }
})
