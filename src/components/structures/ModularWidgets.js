class ModularWidgets {
    static widgetTypes = [
        {
            type: 'etherpad',
            icon: 'http://localhost:8000/static/etherpad.svg',
            name: 'Etherpad',
            description: 'Collaborative text editor',
        },
        {
            type: 'grafana',
            icon: 'http://localhost:8000/static/grafana.svg',
            name: 'Grafana',
            description: 'Graph and monitor all the things!',
        },
    ];
}
export default ModularWidgets;
