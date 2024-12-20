function toggleWidget() {
    var iframe = document.getElementById("widget-frame");
    if (iframe) {
        FreshworksWidget("close");
    } else {
        FreshworksWidget("open");
    }
}
function init() {
    window.fwSettings = {
        widget_id: 80000004505,
        locale: "nb-NO",
    };

    !(function () {
        if ("function" != typeof window.FreshworksWidget) {
            var n = function () {
                n.q.push(arguments);
            };
            (n.q = []), (window.FreshworksWidget = n);
        }
    })();
    FreshworksWidget("hide", "launcher");
}
init();
export default toggleWidget;
