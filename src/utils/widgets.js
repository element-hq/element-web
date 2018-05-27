import MatrixClientPeg from '../MatrixClientPeg';

/**
 * Get all widgets (user and room) for the current user
 * @param  {object} room The room to get widgets for
 * @return {[object]} Array containing current / active room and user widget state events
 */
function getWidgets(room) {
    const widgets = getRoomWidgets(room);
    widgets.concat(getUserWidgetsArray());
    return widgets;
}

/**
 * Get room specific widgets
 * @param  {object} room The room to get widgets force
 * @return {[object]} Array containing current / active room widgets
 */
function getRoomWidgets(room) {
    const appsStateEvents = room.currentState.getStateEvents('im.vector.modular.widgets');
    if (!appsStateEvents) {
        return [];
    }

    return appsStateEvents.filter((ev) => {
        return ev.getContent().type && ev.getContent().url;
    });
}

/**
 * Get user specific widgets (not linked to a specific room)
 * @return {object} Event content object containing current / active user widgets
 */
function getUserWidgets() {
    const client = MatrixClientPeg.get();
    if (!client) {
        throw new Error('User not logged in');
    }
    const userWidgets = client.getAccountData('m.widgets');
    let userWidgetContent = {};
    if (userWidgets && userWidgets.getContent()) {
      userWidgetContent = userWidgets.getContent();
    }
    return userWidgetContent;
}

/**
 * Get user specific widgets (not linked to a specific room) as an array
 * @return {[object]} Array containing current / active user widgets
 */
function getUserWidgetsArray() {
  return Object.values(getUserWidgets());
}

/**
 * Get active stickerpicker widgets (stickerpickers are user widgets by nature)
 * @return {[object]} Array containing current / active stickerpicker widgets
 */
function getStickerpickerWidgets() {
    const widgets = getUserWidgetsArray();
    return widgets.filter((widget) => widget.content && widget.content.type === "m.stickerpicker");
}

/**
 * Remove all stickerpicker widgets (stickerpickers are user widgets by nature)
 * @return {Promise} Resolves on account data updated
 */
function removeStickerpickerWidgets() {
    const client = MatrixClientPeg.get();
    if (!client) {
        throw new Error('User not logged in');
    }
    const userWidgets = client.getAccountData('m.widgets').getContent() || {};
    Object.entries(userWidgets).forEach(([key, widget]) => {
        if (widget.content && widget.content.type === 'm.stickerpicker') {
            delete userWidgets[key];
        }
    });
    return client.setAccountData('m.widgets', userWidgets);
}


export default {
    getWidgets,
    getRoomWidgets,
    getUserWidgets,
    getUserWidgetsArray,
    getStickerpickerWidgets,
    removeStickerpickerWidgets,
};
