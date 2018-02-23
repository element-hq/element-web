import MatrixClientPeg from '../MatrixClientPeg';

/**
 * Get all widgets (user and room) for the current user
 * @param  {object} room The room to get widgets for
 * @return {[object]} Array containing current / active room and user widget state events
 */
function getWidgets(room) {
    const widgets = getRoomWidgets(room);
    widgets.concat(getUserWidgets());
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
 * @return {[object]} Array containing current / active user widgets
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
    return Object.keys(userWidgetContent).map((key) => userWidgetContent[key]);
}

/**
 * Get active stickerpack widgets (stickerpacks are user widgets by nature)
 * @return {[object]} Array containing current / active stickerpack widgets
 */
function getStickerpackWidgets() {
    const widgets = getUserWidgets();
    const stickerpackWidgets = widgets.filter((widget) => widget.type='stickerpack');
    return stickerpackWidgets;
}

/**
 * Remove all stickerpack widgets (stickerpacks are user widgets by nature)
 */
function removeStickerpackWidgets() {
    const client = MatrixClientPeg.get();
    if (!client) {
        throw new Error('User not logged in');
    }
    const userWidgets = client.getAccountData('m.widgets').getContent() || {};
    Object.entries(userWidgets).forEach(([key, widget]) => {
        if (widget.type === 'stickerpack') {
            delete userWidgets[key];
        }
    });
    client.setAccountData('m.widgets', userWidgets);
}


export default {
    getWidgets,
    getRoomWidgets,
    getUserWidgets,
    getStickerpackWidgets,
    removeStickerpackWidgets,
};
