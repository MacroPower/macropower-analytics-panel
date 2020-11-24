# macropower-analytics-panel Server

A very simple http listener for macropower-analytics-panel.

It can be used to add data to systems supporting the OpenMetrics standard (e.g. Prometheus, InfluxDB 2.0) and/or your logging system of choice (e.g. Loki).

```text
Usage: grafana_analytics_server

HTTP listener for the macropower-analytics-panel Grafana plugin.

Flags:
  -h, --help                    Show context-sensitive help.
      --http-address=":8080"    Address to listen on for payloads and metrics.
      --session-timeout=0       The maximum duration that may be added between
                                heartbeats. 0 = unlimited ($SESSION_TIMEOUT).
      --disable-session-log     Disables logging sessions to the console.
      --disable-variable-log    Disables logging variables to the console.
```

This service implements two endpoints:

- `/write`, the listener for plugin payloads.
- `/metrics`, the Prometheus metrics endpoint.

Logs are simply output to stdout. You can pick them up and ship them to your preferred logging system. For instance, if you use Loki, you can simply run this service as a container and use [Loki's Docker driver](https://grafana.com/docs/loki/latest/clients/docker-driver/).
