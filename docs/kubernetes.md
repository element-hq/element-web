Running in Kubernetes
=====================

In case you would like to deploy element-web in a kubernetes cluster you can use
the provided Kubernetes example below as a starting point. Note that this example assumes the
Nginx ingress to be installed.

Note that the content of the required `config.json` is defined inside this yaml because it needs
to be put in your Kubernetes cluster as a `ConfigMap`.

So to use it you must create a file with this content as a starting point and modify it so it meets
the requirements of your environment.

Then you can deploy it to your cluster with something like `kubectl apply -f my-element-web.yaml`.

    # This is an example of a POSSIBLE config for deploying a single element-web instance in Kubernetes

    # Use the element-web namespace to put it all in.

    apiVersion: v1
    kind: Namespace
    metadata:
      name: element-web

    ---

    # The config.json file is to be put into Kubernetes as a config file in such a way that
    # the element web instance can read it.
    # The code below shows how this can be done with the config.sample.json content.

    apiVersion: v1
    kind: ConfigMap
    metadata:
      name: element-config
      namespace: element-web
    data:
      config.json: |
        {
            "default_server_config": {
                "m.homeserver": {
                    "base_url": "https://matrix-client.matrix.org",
                    "server_name": "matrix.org"
                },
                "m.identity_server": {
                    "base_url": "https://vector.im"
                }
            },
            "disable_custom_urls": false,
            "disable_guests": false,
            "disable_login_language_selector": false,
            "disable_3pid_login": false,
            "brand": "Element",
            "integrations_ui_url": "https://scalar.vector.im/",
            "integrations_rest_url": "https://scalar.vector.im/api",
            "integrations_widgets_urls": [
                    "https://scalar.vector.im/_matrix/integrations/v1",
                    "https://scalar.vector.im/api",
                    "https://scalar-staging.vector.im/_matrix/integrations/v1",
                    "https://scalar-staging.vector.im/api",
                    "https://scalar-staging.riot.im/scalar/api"
            ],
            "bug_report_endpoint_url": "https://element.io/bugreports/submit",
            "defaultCountryCode": "GB",
            "showLabsSettings": false,
            "features": { },
            "default_federate": true,
            "default_theme": "light",
            "roomDirectory": {
                "servers": [
                        "matrix.org"
                ]
            },
            "piwik": {
                "url": "https://piwik.riot.im/",
                "whitelistedHSUrls": ["https://matrix.org"],
                "whitelistedISUrls": ["https://vector.im", "https://matrix.org"],
                "siteId": 1
            },
            "enable_presence_by_hs_url": {
                "https://matrix.org": false,
                "https://matrix-client.matrix.org": false
            },
            "settingDefaults": {
                "breadcrumbs": true
            },
            "jitsi": {
                "preferredDomain": "jitsi.riot.im"
            }
        }


    ---

    # A deployment of the element-web for a single instance

    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: element
      namespace: element-web
    spec:
      selector:
        matchLabels:
          app: element
      replicas: 1
      template:
        metadata:
          labels:
            app: element
        spec:
          containers:
          - name: element
            image: vectorim/element-web:latest
            volumeMounts:
            - name: config-volume
              mountPath: /app/config.json
              subPath: config.json
            ports:
            - containerPort: 80
              name: element
              protocol: TCP
            readinessProbe:
                httpGet:
                    path: /
                    port: element
                initialDelaySeconds: 2
                periodSeconds: 3
            livenessProbe:
                httpGet:
                    path: /
                    port: element
                initialDelaySeconds: 10
                periodSeconds: 10
          volumes:
          - name: config-volume
            configMap:
              name: element-config

    ---

    # Wrap it all in a Service

    apiVersion: v1
    kind: Service
    metadata:
      name: element
      namespace: element-web
    spec:
      selector:
        app: element
      ports:
        - name: default
          protocol: TCP
          port: 80
          targetPort: 80

    ---

    # An ingress definition to expose the service via a hostname

    apiVersion: networking.k8s.io/v1
    kind: Ingress
    metadata:
      name: element
      namespace: element-web
      annotations:
        kubernetes.io/ingress.class: nginx
        nginx.ingress.kubernetes.io/configuration-snippet: |
          add_header X-Frame-Options SAMEORIGIN;
          add_header X-Content-Type-Options nosniff;
          add_header X-XSS-Protection "1; mode=block";
          add_header Content-Security-Policy "frame-ancestors 'none'";
    spec:
      rules:
        - host: element.example.nl
          http:
            paths:
              - pathType: Prefix
                path: /
                backend:
                  service:
                    name: element
                    port:
                      number: 80

    ---

