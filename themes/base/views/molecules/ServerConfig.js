var React = require('react');

var ServerConfigController = require("../../../../src/controllers/molecules/ServerConfig");

module.exports = React.createClass({
    displayName: 'ServerConfig',
    mixins: [ServerConfigController],

    render: function() {
        return (
            <div className="HomeServerTextBox">
                <table className="serverConfig">
                <tr>
                <td>Home Server URL</td>
                <td><input type="text" value={this.state.hs_url} onChange={this.hsChanged} /></td>
                </tr>
                <tr>
                <td>Identity Server URL</td>
                <td><input type="text" value={this.state.is_url} onChange={this.isChanged} /></td>
                </tr>
                </table>
            </div>
        );
    }
});
