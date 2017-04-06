'use strict';

var React = require('react');
var ReactDOM = require('react-dom');

module.exports = React.createClass({
    displayName: 'AutomatedLoginFromParent',
		onMessage(e) {
			/*if (e.origin !== "http://example.com") {
				return;
			}*/
			p = JSON.parse(e.data);
			localStorage.setItem('mx_access_token', JSON.stringify(p.mx_access_token));
      console.log(p);
      console.log(e);
    },
    render: function() {
        return (
        	console.log('oi!');
        );
    }
});
