/* A dummy React component which we use for stubbing out app-level components
 */
'use strict';

const React = require('react');

module.exports = function(opts) {
    opts = opts || {};
    if (!opts.displayName) {
        opts.displayName = 'StubComponent';
    }

    if (!opts.render) {
        opts.render = function() {
            return <div>{ this.displayName }</div>;
        };
    }

    return React.createClass(opts);
};
