# macropower-analytics-panel Server

A very simple http listener for macropower-analytics-panel.

It can be used to expose data to systems supporting the OpenMetrics standard (e.g. Prometheus, InfluxDB 2.0) and/or your logging system of choice (e.g. Loki).

The service implements two endpoints:

- `/write`, the listener for plugin payloads.
- `/metrics`, the Prometheus metrics endpoint.

Logs are simply output to stdout. You can pick them up and ship them to your preferred logging system. For instance, if you use Loki, you can simply run this service as a container and use [Loki's Docker driver](https://grafana.com/docs/loki/latest/clients/docker-driver/).

## Usage

```text
Usage: grafana_analytics_server

A receiver for the macropower-analytics-panel Grafana plugin.

Flags:
  -h, --help                    Show context-sensitive help.
      --http-address=":8080"    Address to listen on for payloads and metrics.
      --session-timeout=15m     The maximum duration that may be added between
                                heartbeats. 0 = unlimited ($SESSION_TIMEOUT).
      --max-cache-size=100000   The maximum number of sessions to store in the
                                cache before resetting. 0 = unlimited.
      --disable-session-log     Disables logging sessions to the console.
      --disable-variable-log    Disables logging variables to the console.
```

### Session Timeout

Session timeout is a useful feature that can prevent sessions from being represented as continuous, even if the user is inactive. It essentially limits the maximum calculated time between two heartbeats. For instance, consider the following sequence of events:

-> User loads Dashboard
-> Uses dashboard for 15 minutes
-> Navigates to a different tab
-> Does other work for 4 hours
-> Navigates back to the dashboard

With no session timeout, this session will be represented as being 4 hours and 15 minutes long. However, if we were to set, for example, `session-timeout=1h`, this session will be represented as being 1 hour 15 minutes long, since the inferred duration where no heartbeats were sent is being capped at 1 hour.

### Max Cache Size

Max cache size is a compromise that prevents needing to run a dedicated database for session data. Instead, an object is stored in-memory for each session uuid. To prevent the service from continually growing until it crashes, the memory must be routinely reset. You might ask why we can't just expire sessions, and that is because we expose [Counters](https://prometheus.io/docs/concepts/metric_types/#counter) which allow you to [rate()](https://prometheus.io/docs/prometheus/latest/querying/functions/#rate) over your data. This allows you to create continuous graphs that represent all data, even if scrapes are missed or the service is restarted.

If you happen to reset memory or restart when session data exists, but has not yet been scraped, this session data will be lost. For existing sessions that are "in progress", the maximum accuracy loss will never be greater than the session timeout duration.

Generally, you should consider the amount of traffic you're generating, and try to ensure that sessions remain cached for at least 24 hours (ideally longer), while also keeping in mind that more sessions in memory corresponds to a higher memory footprint.
